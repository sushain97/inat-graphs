#!/usr/bin/env python3

import collections
import datetime
import itertools
import json
from pathlib import Path

import plotly.graph_objects as go
import pyinaturalist
import streamlit as st
from pyinaturalist.constants import ICONIC_EMOJI, ICONIC_TAXA

from days import format_date
from utils import ObservationSummary, get_observations, species_name

_TAXON_EMOJI: dict[str, str] = {
    name: ICONIC_EMOJI[tid] for tid, name in ICONIC_TAXA.items()
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


@st.cache_data(ttl=86400, show_spinner="Looking up place names...")
def fetch_place_names(place_ids: tuple[int, ...]) -> dict[int, str]:
    result: dict[int, str] = {}
    chunk_size = 30
    for i in range(0, len(place_ids), chunk_size):
        chunk = list(place_ids[i : i + chunk_size])
        response = pyinaturalist.get_places_by_id(chunk)
        for place in response["results"]:
            result[place["id"]] = place["display_name"]
    return result


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
        rows.append(
            {
                "Species": name,
                "Common name": obs_list[0].taxon.preferred_common_name or "",
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


st.set_page_config(page_title="🦜Birding", layout="wide")
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
title_col.title("🦜Birding")
if btn_col.button("↺ Refresh", use_container_width=True):
    st.cache_resource.clear()
    st.cache_data.clear()
    st.rerun()

summary, _ = fetch_observations()

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
    f"Wingspan set coverage ({counts[0]}/{counts[1]})", anchor="wingspan-set-coverage"
)
st.plotly_chart(figure, config=PLOTLY_CONFIG)
