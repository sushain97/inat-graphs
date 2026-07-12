#!/usr/bin/env python3

import base64
import collections
import datetime
import itertools
import json
import os
from pathlib import Path

import pandas as pd
import plotly.graph_objects as go
import pyinaturalist
import requests
import streamlit as st
from pyinaturalist.constants import ICONIC_EMOJI, ICONIC_TAXA
from st_aggrid import AgGrid, GridOptionsBuilder, GridUpdateMode, StAggridTheme

from days import format_date
from utils import ObservationSummary, get_observations, species_name

_TAXON_EMOJI: dict[str, str] = {
    name: ICONIC_EMOJI[tid] for tid, name in ICONIC_TAXA.items()
}

BEST_OF_BIRDING_ALBUM_ID = "c172ef8b-6f76-4abe-9ed5-cdd3292cc404"
IMMICH_BASE_URL = "https://photos.skc.name"
IMMICH_API_KEY = os.environ.get("IMMICH_API_KEY")
IMMICH_HEADERS = {
    "Accept": "application/json",
    "x-api-key": IMMICH_API_KEY,
}
BEST_OF_CLASSES = ["Male", "Female", "Indeterminate", "Immature", "Multiple"]
BEST_OF_CLASS_LABELS = {
    "Male": "Male (♂)",
    "Female": "Female (♀)",
    "Immature": "Immature (⚲)",
}


def taxon_label(name: str) -> str:
    emoji = _TAXON_EMOJI.get(name, "")
    return f"{emoji} {name}" if emoji else name


def country_flag(display_name: str) -> str:
    code = display_name.rsplit(",", 1)[-1].strip()
    if len(code) == 2 and code.isalpha() and code.isupper():
        return "".join(chr(0x1F1E6 + ord(c) - ord("A")) for c in code)
    return ""


BASE_DIR = Path(__file__).parent
PLOTLY_CONFIG = {"displayModeBar": False}


@st.cache_resource(ttl=3600, show_spinner="Loading observations…")
def fetch_observations():
    session = pyinaturalist.ClientSession()
    return get_observations(session)


@st.cache_data(ttl=86400, show_spinner="Looking up place names…")
def fetch_place_names(place_ids: tuple[int, ...]) -> dict[int, str]:
    result: dict[int, str] = {}
    chunk_size = 30
    for i in range(0, len(place_ids), chunk_size):
        chunk = list(place_ids[i : i + chunk_size])
        response = pyinaturalist.get_places_by_id(chunk)
        for place in response["results"]:
            result[place["id"]] = place["display_name"]
    return result


def get_album_assets(album_id: str) -> list[dict]:
    album_response = requests.get(
        f"{IMMICH_BASE_URL}/api/albums/{album_id}", headers=IMMICH_HEADERS
    )
    album_response.raise_for_status()
    album = album_response.json()
    owner_by_id = {
        entry["user"]["id"]: entry["user"]["name"] for entry in album["albumUsers"]
    }

    buckets_response = requests.get(
        f"{IMMICH_BASE_URL}/api/timeline/buckets",
        headers=IMMICH_HEADERS,
        params={"albumId": album_id, "isTrashed": "false"},
    )
    buckets_response.raise_for_status()
    time_buckets = [b["timeBucket"] for b in buckets_response.json()]

    assets = []
    for time_bucket in time_buckets:
        bucket_response = requests.get(
            f"{IMMICH_BASE_URL}/api/timeline/bucket",
            headers=IMMICH_HEADERS,
            params={
                "albumId": album_id,
                "timeBucket": time_bucket,
                "isTrashed": "false",
            },
        )
        bucket_response.raise_for_status()
        bucket = bucket_response.json()
        for asset_id, file_created_at, owner_id in zip(
            bucket["id"], bucket["fileCreatedAt"], bucket["ownerId"]
        ):
            assets.append(
                {
                    "id": asset_id,
                    "fileCreatedAt": file_created_at,
                    "owner": owner_by_id.get(owner_id, owner_id),
                }
            )

    return assets


def get_asset_tags(asset_id: str) -> list[str]:
    cache_path = os.path.expanduser(f"~/.cache/immich/tags/{asset_id}.json")
    if os.path.exists(cache_path):
        with open(cache_path) as f:
            tags = json.load(f)
            if len(tags) > 0:
                return tags

    response = requests.get(
        f"{IMMICH_BASE_URL}/api/assets/{asset_id}", headers=IMMICH_HEADERS
    )
    response.raise_for_status()
    tags = [tag["value"] for tag in response.json()["tags"]]

    os.makedirs(os.path.dirname(cache_path), exist_ok=True)
    with open(cache_path, "w") as f:
        json.dump(tags, f)

    return tags


@st.cache_data(ttl=86400, show_spinner=False)
def get_asset_thumbnail(asset_id: str) -> bytes:
    response = requests.get(
        f"{IMMICH_BASE_URL}/api/assets/{asset_id}/thumbnail",
        headers=IMMICH_HEADERS,
        params={"size": "thumbnail"},
    )
    response.raise_for_status()
    return response.content


@st.cache_resource(ttl=3600, show_spinner="Loading best-of album…")
def fetch_best_of_summary(
    _summary: ObservationSummary,
) -> tuple[dict[str, dict[str, list[str]]], dict[str, str], set[str], list[str]]:
    summary = _summary
    species_by_name = {
        species_name(obs.taxon.name): (
            obs.taxon.ancestors[-1].preferred_common_name
            if obs.taxon.rank == "subspecies"
            else obs.taxon.preferred_common_name
        )
        for obs in summary.research_grade_observations + summary.needs_id_observations
    }
    species_by_name.update(
        {
            "Cairina moschata": "Muscovy Duck",
            "Felis catus": "Cat",
            "Larus livens": "Yellow-footed gull",
        }
    )

    missing_species = set(
        species_name(observation.taxon.name)
        for observation in summary.research_grade_observations
        if observation.quality_grade == "research"
        and (
            observation.taxon.iconic_taxon_name
            not in ["Fungi", "Arachnida", "Insecta", "Mollusca"]
        )
        and observation.observed_on.date() >= datetime.date(2025, 10, 8)
        and "Arthropoda" not in {a.name for a in observation.taxon.ancestors}
    )

    assets = get_album_assets(BEST_OF_BIRDING_ALBUM_ID)

    photos: dict[str, dict[str, list[str]]] = collections.defaultdict(
        lambda: collections.defaultdict(list)
    )
    warnings: list[str] = []

    for asset in assets:
        tags = [t for t in get_asset_tags(asset["id"]) if t.startswith("Birding/")]
        owner = asset["owner"]
        created = asset["fileCreatedAt"].split("T")[0]
        photo_url = f"{IMMICH_BASE_URL}/photos/{asset['id']}"
        if len(tags) == 0:
            warnings.append(f"[{owner} / {created}] no birding tags -> {photo_url}")
            continue
        if len(tags) > 1:
            warnings.append(
                f"[{owner} / {created}] Multiple birding tags: {tags} -> {photo_url}"
            )
            continue
        _, name, klass = tags[0].split("/")
        if klass not in BEST_OF_CLASSES:
            warnings.append(
                f"[{owner} / {created}] Invalid class '{klass}' -> {photo_url}"
            )
            continue
        photos[name][klass].append(asset["id"])
        missing_species.discard(name)

    return (
        {name: dict(classes) for name, classes in photos.items()},
        species_by_name,
        missing_species,
        warnings,
    )


def _reset_best_of_grid() -> None:
    # Clear the selection on the *next* render without changing the grid's
    # `key`, which would force an expensive full remount of the component.
    st.session_state["best_of_grid_clear_selection"] = True


@st.dialog("Photos", width="large", on_dismiss=_reset_best_of_grid)
def show_species_photos_dialog(
    name: str, common_name: str, species_photos: dict[str, list[str]]
) -> None:
    st.subheader(f"{common_name} ({name})" if common_name else name)

    if not any(species_photos.get(klass) for klass in BEST_OF_CLASSES):
        st.info("No photos tagged for this species yet.")
        return

    with st.spinner("Loading photos…"):
        thumbnails_by_klass = {
            klass: [
                (asset_id, get_asset_thumbnail(asset_id))
                for asset_id in species_photos[klass]
            ]
            for klass in BEST_OF_CLASSES
            if species_photos.get(klass)
        }

    for klass, thumbnails in thumbnails_by_klass.items():
        st.markdown(f"**{BEST_OF_CLASS_LABELS.get(klass, klass)}**")
        cols = st.columns(4)
        for i, (asset_id, thumbnail) in enumerate(thumbnails):
            with cols[i % 4]:
                st.markdown(
                    f'<a href="{IMMICH_BASE_URL}/photos/{asset_id}" target="_blank">'
                    f'<img src="data:image/jpeg;base64,{base64.b64encode(thumbnail).decode()}" '
                    f'style="width:100%;border-radius:4px;" /></a>',
                    unsafe_allow_html=True,
                )


def render_best_of_birding(summary: ObservationSummary) -> None:
    if not IMMICH_API_KEY:
        st.error("IMMICH_API_KEY is not set; Best of Birding data is unavailable.")
        return

    photos, species_by_name, missing_species, warnings = fetch_best_of_summary(summary)

    if warnings:
        with st.expander(f"Warnings ({len(warnings)})"):
            st.markdown("\n".join(f"- {w}" for w in warnings))

    rows = [
        {
            "Name": name,
            "Common Name": species_by_name.get(name, ""),
            **{
                klass: len(species_photos[klass]) if species_photos.get(klass) else None
                for klass in BEST_OF_CLASSES
            },
            "Total": sum(len(v) for v in species_photos.values()),
        }
        for name, species_photos in photos.items()
    ] + [
        {
            "Name": name,
            "Common Name": species_by_name.get(name, ""),
            **{klass: None for klass in BEST_OF_CLASSES},
            "Total": 0,
        }
        for name in missing_species
    ]
    rows.sort(key=lambda r: r["Total"], reverse=True)

    builder = GridOptionsBuilder.from_dataframe(pd.DataFrame(rows))
    builder.configure_default_column(sortable=True, filter=False, resizable=True)
    builder.configure_column("Name", header_name="Scientific Name", width=200)
    builder.configure_column("Common Name", header_name="Common Name", width=200)
    for klass in BEST_OF_CLASSES:
        builder.configure_column(
            klass,
            header_name=BEST_OF_CLASS_LABELS.get(klass, klass),
            type=["numericColumn"],
            width=100,
        )
    builder.configure_column(
        "Total", header_name="Σ", type=["numericColumn"], width=100, sort="desc"
    )
    just_dismissed = st.session_state.pop("best_of_grid_clear_selection", False)
    builder.configure_selection(selection_mode="single", use_checkbox=False)

    grid_theme = (
        StAggridTheme(base="quartz")
        .withParts("colorSchemeDark")
        .withParams(
            fontFamily=(
                "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, "
                "Helvetica, Arial, sans-serif"
            ),
            accentColor="#ff4b4b",
            spacing=6,
            rowHeight=32,
        )
    )

    grid = AgGrid(
        pd.DataFrame(rows),
        gridOptions=builder.build(),
        height=600,
        update_mode=GridUpdateMode.SELECTION_CHANGED,
        theme=grid_theme,
        key="best_of_grid",
        show_toolbar=True,
        show_search=True,
        show_download_button=False,
    )

    # On the render right after a dialog dismissal, `grid.selected_rows` still
    # reflects the stale pre-dismissal selection (the frontend hasn't caught
    # up yet), so skip reopening the dialog on that one render.
    selected_rows = None if just_dismissed else grid.selected_rows
    if selected_rows is not None and len(selected_rows) > 0:
        selected_name = selected_rows.iloc[0]["Name"]
        selected_common_name = selected_rows.iloc[0]["Common Name"]
        show_species_photos_dialog(
            selected_name,
            selected_common_name,
            photos.get(selected_name, {}),
        )


def build_lifetime_species_figure(summary: ObservationSummary) -> go.Figure:
    research_grade_counts = dict(
        collections.Counter(t.iconic_taxon_name for t in summary.research_grade_taxons)
    )
    needs_id_counts = dict(
        collections.Counter(t.iconic_taxon_name for t in summary.needs_id_taxons)
    )
    taxons = sorted(research_grade_counts, key=research_grade_counts.get)
    taxon_labels = [taxon_label(t) for t in taxons]

    figure = go.Figure()
    figure.add_trace(
        go.Bar(
            name=f"Needs ID ({sum(needs_id_counts.values())})",
            y=taxon_labels,
            x=[needs_id_counts.get(t, 0) for t in taxons],
            orientation="h",
            text=[needs_id_counts.get(t, 0) or "" for t in taxons],
            textposition="outside",
            hoverinfo="skip",
            marker_color="gold",
            legendrank=2,
        )
    )
    figure.add_trace(
        go.Bar(
            name=f"Research Grade ({sum(research_grade_counts.values())})",
            y=taxon_labels,
            x=[research_grade_counts[t] for t in taxons],
            orientation="h",
            text=[research_grade_counts[t] or "" for t in taxons],
            textposition="outside",
            hoverinfo="skip",
            marker_color="mediumseagreen",
            legendrank=1,
        )
    )
    figure.update_layout(
        barmode="group",
        xaxis_title="Species count",
        yaxis=dict(tickfont=dict(size=14)),
        margin_t=0,
        legend=dict(orientation="h", yanchor="top", y=-0.2, xanchor="center", x=0.5),
    )
    return figure


def build_top_days_figure(summary: ObservationSummary):
    research_grade_species_by_day = {
        day: set(
            (species_name(obs.taxon.name), obs.taxon.preferred_common_name)
            for obs in group
        )
        for day, group in itertools.groupby(
            sorted(
                summary.research_grade_observations, key=lambda o: o.observed_on.date()
            ),
            key=lambda o: o.observed_on.date(),
        )
    }
    rg_names_by_day = {
        day: {sn for sn, _ in obs} for day, obs in research_grade_species_by_day.items()
    }
    needs_id_species_by_day = {
        day: set(
            (species_name(obs.taxon.name), obs.taxon.preferred_common_name)
            for obs in group
            if species_name(obs.taxon.name) not in rg_names_by_day.get(day, set())
        )
        for day, group in itertools.groupby(
            sorted(summary.needs_id_observations, key=lambda o: o.observed_on.date()),
            key=lambda o: o.observed_on.date(),
        )
    }
    all_days = set(research_grade_species_by_day) | set(needs_id_species_by_day)
    best_days = sorted(
        [
            (
                day,
                len(research_grade_species_by_day.get(day, set())),
                len(needs_id_species_by_day.get(day, set())),
                len(research_grade_species_by_day.get(day, set()))
                + len(needs_id_species_by_day.get(day, set())),
            )
            for day in all_days
        ],
        key=lambda x: (x[3], x[1]),
    )[-10:]

    labels = [format_date(d) for d, _, _, _ in best_days]
    figure = go.Figure()
    figure.add_trace(
        go.Bar(
            name="Needs ID",
            y=labels,
            x=[needs_id for _, _, needs_id, _ in best_days],
            orientation="h",
            text=[needs_id or "" for _, _, needs_id, _ in best_days],
            textposition="outside",
            hoverinfo="skip",
            marker_color="gold",
            legendrank=2,
        )
    )
    figure.add_trace(
        go.Bar(
            name="Research Grade",
            y=labels,
            x=[research_grade for _, research_grade, _, _ in best_days],
            orientation="h",
            text=[research_grade or "" for _, research_grade, _, _ in best_days],
            textposition="outside",
            hoverinfo="skip",
            marker_color="mediumseagreen",
            legendrank=1,
        )
    )
    figure.update_layout(
        barmode="group",
        xaxis_title="Species count",
        margin_t=0,
        legend=dict(orientation="h", yanchor="top", y=-0.2, xanchor="center", x=0.5),
    )

    best_days_needs_id = {
        d: needs_id_species_by_day.get(d, set()) for d, _, _, _ in best_days
    }
    return figure, best_days_needs_id


def build_new_species_days_figure(summary: ObservationSummary) -> go.Figure:
    new_by_day_taxon: dict[datetime.date, collections.Counter] = (
        collections.defaultdict(collections.Counter)
    )
    for obs in summary.first_research_observations:
        new_by_day_taxon[obs.observed_on.date()][obs.taxon.iconic_taxon_name] += 1

    best_days = sorted(
        new_by_day_taxon.items(),
        key=lambda x: sum(x[1].values()),
    )[-10:]
    taxons = sorted({t for _, counts in best_days for t in counts})
    labels = [format_date(d) for d, _ in best_days]

    totals = [sum(counts.values()) for _, counts in best_days]

    figure = go.Figure()
    for i, taxon in enumerate(taxons):
        figure.add_trace(
            go.Bar(
                name=taxon_label(taxon),
                y=labels,
                x=[counts.get(taxon, 0) for _, counts in best_days],
                orientation="h",
                hovertemplate="%{x}<extra></extra>",
            )
        )
    figure.add_trace(
        go.Scatter(
            y=labels,
            x=totals,
            mode="text",
            text=[f" {t}" for t in totals],
            textposition="middle right",
            showlegend=False,
            hoverinfo="skip",
        )
    )
    figure.update_layout(
        barmode="stack",
        xaxis_title="New species count",
        yaxis_type="category",
        margin_t=0,
        legend=dict(orientation="h", yanchor="top", y=-0.2, xanchor="center", x=0.5),
    )
    return figure


def build_localities_figure(summary: ObservationSummary) -> go.Figure:
    eligible = [
        obs
        for obs in summary.first_research_observations
        if obs.place_ids and len(obs.place_ids) > 1
    ]
    unique_place_ids = tuple({obs.place_ids[1] for obs in eligible})
    place_names = fetch_place_names(unique_place_ids)

    new_by_locality_taxon: dict[str, collections.Counter] = collections.defaultdict(
        collections.Counter
    )
    taxon_counts: collections.Counter = collections.Counter()
    for obs in eligible:
        locality = place_names.get(obs.place_ids[1], str(obs.place_ids[1]))
        new_by_locality_taxon[locality][obs.taxon.iconic_taxon_name] += 1
        taxon_counts[obs.taxon.iconic_taxon_name] += 1

    best_localities = sorted(
        new_by_locality_taxon.items(),
        key=lambda x: sum(x[1].values()),
    )[-10:]
    taxons = sorted(taxon_counts, key=taxon_counts.get, reverse=True)
    labels = [
        f"{flag} {loc}" if (flag := country_flag(loc)) else loc
        for loc, _ in best_localities
    ]

    totals = [sum(counts.values()) for _, counts in best_localities]

    figure = go.Figure()
    for _, taxon in enumerate(taxons):
        figure.add_trace(
            go.Bar(
                name=taxon_label(taxon),
                y=labels,
                x=[counts.get(taxon, 0) for _, counts in best_localities],
                orientation="h",
                hovertemplate="%{x}<extra></extra>",
            )
        )
    figure.add_trace(
        go.Scatter(
            y=labels,
            x=totals,
            mode="text",
            text=[f" {t}" for t in totals],
            textposition="middle right",
            showlegend=False,
            hoverinfo="skip",
        )
    )
    figure.update_layout(
        barmode="stack",
        xaxis_title="New species count",
        xaxis_rangemode="tozero",
        yaxis_type="category",
        margin_t=0,
        yaxis=dict(tickfont=dict(size=14)),
        legend=dict(orientation="h", yanchor="top", y=-0.2, xanchor="center", x=0.5),
    )
    return figure


def new_needs_id_rows(summary: ObservationSummary) -> list[dict]:
    rg_names = {species_name(t.name) for t in summary.research_grade_taxons}
    min_date = datetime.date.today() - datetime.timedelta(days=60)

    rows = []
    for name, group in itertools.groupby(
        sorted(
            [
                obs
                for obs in summary.needs_id_observations
                if species_name(obs.taxon.name) not in rg_names
                and obs.observed_on.date() >= min_date
            ],
            key=lambda o: species_name(o.taxon.name),
        ),
        key=lambda o: species_name(o.taxon.name),
    ):
        obs_list = list(group)
        dates = sorted({str(o.observed_on.date()) for o in obs_list}, reverse=True)
        common_name = obs_list[0].taxon.preferred_common_name
        emoji = obs_list[0].taxon.emoji
        rows.append(
            {
                "Name": f"{emoji} {common_name} ({name})"
                if common_name
                else f"{emoji} {name}",
                "Last seen": dates[0],
                "All dates": ", ".join(dates),
            }
        )
    return sorted(rows, key=lambda r: r["Last seen"], reverse=True)


def build_most_seen_figure(summary: ObservationSummary) -> go.Figure:
    by_species = itertools.groupby(
        sorted(
            summary.research_grade_observations,
            key=lambda o: o.taxon.preferred_common_name,
        ),
        key=lambda o: o.taxon.preferred_common_name,
    )
    top_seen = sorted(
        [
            (species, len({o.observed_on.date() for o in obs}))
            for species, obs in by_species
        ],
        key=lambda x: x[1],
    )[-5:]

    figure = go.Figure(
        go.Bar(
            y=[species for species, _ in top_seen],
            x=[n for _, n in top_seen],
            orientation="h",
            text=[n for _, n in top_seen],
            textposition="outside",
            hoverinfo="skip",
            marker_color="mediumseagreen",
        )
    )
    figure.update_layout(
        xaxis_title="Days observed",
        height=250,
        margin_t=0,
        legend=dict(orientation="h", yanchor="top", y=-0.2, xanchor="center", x=0.5),
    )
    return figure


def build_wingspan_coverage_figure(summary: ObservationSummary) -> go.Figure:
    with open(BASE_DIR / "wingspan-master.json") as f:
        master = json.load(f)
    with open(BASE_DIR / "wingspan-hummingbirds.json") as f:
        hummingbirds = json.load(f)

    birds_by_set = {
        k: list(v)
        for k, v in itertools.groupby(
            sorted(master, key=lambda w: w["Set"]), key=lambda w: w["Set"]
        )
    }
    birds_by_set["hummingbird"] = hummingbirds

    rg_species = {t.name for t in summary.research_grade_taxons}
    needs_id_species = {t.name for t in summary.needs_id_taxons}

    def category(bird: dict) -> str:
        n = bird["Scientific name"]
        if n in rg_species:
            return "Research Grade"
        if n in needs_id_species:
            return "Needs ID"
        return "Missing"

    cats = ["Research Grade", "Needs ID", "Missing"]
    counts_by_set = dict(
        sorted(
            {
                s: {
                    k: len(list(v))
                    for k, v in itertools.groupby(
                        sorted(birds, key=category), key=category
                    )
                }
                | {"Total": len(birds)}
                for s, birds in birds_by_set.items()
            }.items(),
            key=lambda i: i[1].get("Research Grade", 0),
        )
    )

    total_rg = sum(v.get("Research Grade", 0) for v in counts_by_set.values())
    total_all = sum(v["Total"] for v in counts_by_set.values())
    labels = list(counts_by_set.keys())

    cat_colors = {
        "Research Grade": "mediumseagreen",
        "Needs ID": "gold",
        "Missing": "lightgray",
    }
    set_totals = [v["Total"] for v in counts_by_set.values()]

    figure = go.Figure()
    for cat in cats:
        figure.add_trace(
            go.Bar(
                name=cat,
                y=labels,
                x=[v.get(cat, 0) for v in counts_by_set.values()],
                orientation="h",
                hovertemplate="%{x}<extra></extra>",
                marker_color=cat_colors[cat],
            )
        )
    figure.add_trace(
        go.Scatter(
            y=labels,
            x=set_totals,
            mode="text",
            text=[f" {t}" for t in set_totals],
            textposition="middle right",
            showlegend=False,
            hoverinfo="skip",
        )
    )
    figure.update_layout(
        barmode="stack",
        xaxis_title="Bird count",
        margin_t=0,
        yaxis=dict(tickfont=dict(size=14)),
        legend=dict(orientation="h", yanchor="top", y=-0.2, xanchor="center", x=0.5),
    )
    return figure, (total_rg, total_all)


def render_needs_id_best_days(
    summary: ObservationSummary,
    best_days_needs_id: dict,
) -> None:
    min_date = datetime.date.today() - datetime.timedelta(days=60)
    needs_id_species = {species_name(t.name) for t in summary.needs_id_taxons}

    rows = [
        (day, species)
        for day, species in sorted(best_days_needs_id.items(), reverse=True)
        if day >= min_date and species
    ]

    if not rows:
        st.info("No Needs ID species on best days in the last 60 days.")
        return

    for day, species in rows:
        labels = [
            (common if common else sname) + (" ⭐" if sname in needs_id_species else "")
            for sname, common in sorted(species)
        ]
        with st.expander(f"{format_date(day)} — {len(species)} species"):
            st.markdown("\n".join(f"- {l}" for l in labels))


st.set_page_config(page_title="🦜 Birding", layout="wide")
st.set_option("client.toolbarMode", "viewer")
st.html("""<style>
        .stMainBlockContainer {
            padding-top: 2.5rem;
        }

        .stAppHeader {
            display: none;
        }
</style>""")

title_col, btn_col = st.columns([10, 1])
title_col.title("🦜 Birding")
if btn_col.button("↺ Refresh", use_container_width=True):
    st.cache_resource.clear()
    st.cache_data.clear()
    st.rerun()

summary, _ = fetch_observations()

TAB_OPTIONS = ["iNat", "Best of Birding"]
if "tab" not in st.session_state:
    initial_tab = st.query_params.get("tab", TAB_OPTIONS[0])
    st.session_state["tab"] = (
        initial_tab if initial_tab in TAB_OPTIONS else TAB_OPTIONS[0]
    )

selected_tab = st.segmented_control(
    "Tab",
    TAB_OPTIONS,
    key="tab",
    label_visibility="collapsed",
)
if not selected_tab:
    selected_tab = st.session_state["tab"]
st.query_params["tab"] = selected_tab

if selected_tab == "iNat":
    st.subheader("Lifetime species by iconic taxon")
    st.plotly_chart(build_lifetime_species_figure(summary), config=PLOTLY_CONFIG)

    top_days_figure, best_days_needs_id = build_top_days_figure(summary)
    st.subheader("Top days by unique species observed")
    st.plotly_chart(top_days_figure, config=PLOTLY_CONFIG)

    st.subheader("Top days by new research grade species")
    st.plotly_chart(build_new_species_days_figure(summary), config=PLOTLY_CONFIG)

    st.subheader("Top localities by new research grade species")
    st.plotly_chart(build_localities_figure(summary), config=PLOTLY_CONFIG)

    st.subheader("New Needs ID species (last 60 days)")
    rows = new_needs_id_rows(summary)
    if rows:
        st.dataframe(rows, hide_index=True)
    else:
        st.info("No new Needs ID species in the last 60 days.")

    st.subheader("Needs ID species on best days (last 60 days)")
    render_needs_id_best_days(summary, best_days_needs_id)

    st.subheader("Most seen research grade species (unique days)")
    st.plotly_chart(build_most_seen_figure(summary), config=PLOTLY_CONFIG)

    figure, counts = build_wingspan_coverage_figure(summary)
    st.subheader(
        f"Wingspan set coverage ({counts[0]}/{counts[1]})",
        anchor="wingspan-set-coverage",
    )
    st.plotly_chart(figure, config=PLOTLY_CONFIG)

if selected_tab == "Best of Birding":
    render_best_of_birding(summary)
