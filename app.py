#!/usr/bin/env python3
import collections
import datetime
import itertools
import json
from pathlib import Path

import plotly.graph_objects as go
import pyinaturalist
import streamlit as st

from days import format_date
from utils import ObservationSummary, get_observations, species_name

GREEN = "#2ecc71"
YELLOW = "#f1c40f"
RED = "#e74c3c"
BLUE = "#3498db"
MAGENTA = "#9b59b6"
CYAN = "#1abc9c"
DARK = "#7f8c8d"
ORANGE = "#e67e22"

TAXON_COLORS = [GREEN, RED, BLUE, MAGENTA, CYAN, YELLOW, DARK, ORANGE]
BASE_DIR = Path(__file__).parent


@st.cache_resource(ttl=3600)
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


def lifetime_species_fig(summary: ObservationSummary) -> go.Figure:
    rg = dict(
        collections.Counter(
            t.iconic_taxon_name for t in summary.research_grade_taxons
        ).most_common()
    )
    nid = dict(
        collections.Counter(
            t.iconic_taxon_name for t in summary.needs_id_taxons
        ).most_common()
    )
    taxons = list(rg.keys())

    fig = go.Figure()
    fig.add_trace(
        go.Bar(
            name=f"Research Grade ({sum(rg.values())})",
            y=taxons,
            x=[rg[t] for t in taxons],
            orientation="h",
            marker_color=GREEN,
        )
    )
    fig.add_trace(
        go.Bar(
            name=f"Needs ID ({sum(nid.values())})",
            y=taxons,
            x=[nid.get(t, 0) for t in taxons],
            orientation="h",
            marker_color=YELLOW,
        )
    )
    fig.update_layout(
        title="Lifetime Species by Iconic Taxon",
        barmode="group",
        xaxis_title="Species Count",
        height=max(300, len(taxons) * 55),
    )
    return fig


def top_days_fig(summary: ObservationSummary):
    rg_species_by_day = {
        day: set(
            (species_name(obs.taxon.name), obs.taxon.preferred_common_name)
            for obs in group
        )
        for day, group in itertools.groupby(
            sorted(summary.research_grade_observations, key=lambda o: o.observed_on.date()),
            key=lambda o: o.observed_on.date(),
        )
    }
    rg_names_by_day = {day: {sn for sn, _ in obs} for day, obs in rg_species_by_day.items()}
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
    all_days = set(rg_species_by_day) | set(needs_id_species_by_day)
    best_days = sorted(
        [
            (
                day,
                len(rg_species_by_day.get(day, set())),
                len(needs_id_species_by_day.get(day, set())),
                len(rg_species_by_day.get(day, set())) + len(needs_id_species_by_day.get(day, set())),
            )
            for day in all_days
        ],
        key=lambda x: (x[3], x[1]),
        reverse=True,
    )[:10]

    labels = [format_date(d) for d, _, _, _ in best_days]
    fig = go.Figure()
    fig.add_trace(
        go.Bar(
            name="Research Grade",
            y=labels,
            x=[rg for _, rg, _, _ in best_days],
            orientation="h",
            marker_color=GREEN,
        )
    )
    fig.add_trace(
        go.Bar(
            name="Needs ID",
            y=labels,
            x=[nid for _, _, nid, _ in best_days],
            orientation="h",
            marker_color=YELLOW,
        )
    )
    fig.update_layout(
        title="Top Days by Unique Species Observed",
        barmode="group",
        xaxis_title="Species Count",
        height=420,
    )

    best_days_needs_id = {d: needs_id_species_by_day.get(d, set()) for d, _, _, _ in best_days}
    return fig, best_days_needs_id


def new_species_days_fig(summary: ObservationSummary) -> go.Figure:
    new_by_day_taxon: dict[datetime.date, collections.Counter] = collections.defaultdict(
        collections.Counter
    )
    for obs in summary.first_research_observations:
        new_by_day_taxon[obs.observed_on.date()][obs.taxon.iconic_taxon_name] += 1

    best_days = sorted(
        new_by_day_taxon.items(), key=lambda x: sum(x[1].values()), reverse=True
    )[:10]
    taxons = sorted({t for _, counts in best_days for t in counts})
    labels = [format_date(d) for d, _ in best_days]

    fig = go.Figure()
    for i, taxon in enumerate(taxons):
        fig.add_trace(
            go.Bar(
                name=taxon,
                y=labels,
                x=[counts.get(taxon, 0) for _, counts in best_days],
                orientation="h",
                marker_color=TAXON_COLORS[i % len(TAXON_COLORS)],
            )
        )
    fig.update_layout(
        title="Top Days by New Research Grade Species",
        barmode="stack",
        xaxis_title="New Species Count",
        height=420,
    )
    return fig


def localities_fig(summary: ObservationSummary) -> go.Figure:
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
        new_by_locality_taxon.items(), key=lambda x: sum(x[1].values()), reverse=True
    )[:10]
    taxons = sorted(taxon_counts, key=taxon_counts.get, reverse=True)  # type: ignore[arg-type]
    labels = [loc for loc, _ in best_localities]

    fig = go.Figure()
    for i, taxon in enumerate(taxons):
        fig.add_trace(
            go.Bar(
                name=taxon,
                y=labels,
                x=[counts.get(taxon, 0) for _, counts in best_localities],
                orientation="h",
                marker_color=TAXON_COLORS[i % len(TAXON_COLORS)],
            )
        )
    fig.update_layout(
        title="Top Localities by New Research Grade Species",
        barmode="stack",
        xaxis_title="New Species Count",
        height=420,
    )
    return fig


def new_needs_id_rows(summary: ObservationSummary) -> list[dict]:
    rg_names = {species_name(t.name) for t in summary.research_grade_taxons}
    min_date = datetime.date.today() - datetime.timedelta(days=30)

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
                "Common Name": obs_list[0].taxon.preferred_common_name or "",
                "Last Seen": dates[0],
                "All Dates": ", ".join(dates),
            }
        )
    return sorted(rows, key=lambda r: r["Last Seen"], reverse=True)


def most_seen_fig(summary: ObservationSummary) -> go.Figure:
    by_species = itertools.groupby(
        sorted(
            summary.research_grade_observations,
            key=lambda o: o.taxon.preferred_common_name,
        ),
        key=lambda o: o.taxon.preferred_common_name,
    )
    top5 = sorted(
        [(sp, len({o.observed_on.date() for o in obs})) for sp, obs in by_species],
        key=lambda x: x[1],
        reverse=True,
    )[:5]

    fig = go.Figure(
        go.Bar(
            y=[sp for sp, _ in top5],
            x=[n for _, n in top5],
            orientation="h",
            marker_color=GREEN,
        )
    )
    fig.update_layout(
        title="Most Seen Research Grade Species (unique days)",
        xaxis_title="Days Observed",
        height=300,
    )
    return fig


def wingspan_coverage_fig(summary: ObservationSummary) -> go.Figure:
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
    nid_species = {t.name for t in summary.needs_id_taxons}

    def category(bird: dict) -> str:
        n = bird["Scientific name"]
        if n in rg_species:
            return "Research Grade"
        if n in nid_species:
            return "Needs ID"
        return "Missing"

    cats = ["Research Grade", "Needs ID", "Missing"]
    counts_by_set = dict(
        sorted(
            {
                s: {
                    k: len(list(v))
                    for k, v in itertools.groupby(sorted(birds, key=category), key=category)
                }
                | {"Total": len(birds)}
                for s, birds in birds_by_set.items()
            }.items(),
            key=lambda i: i[1].get("Research Grade", 0),
            reverse=True,
        )
    )

    total_rg = sum(v.get("Research Grade", 0) for v in counts_by_set.values())
    total_all = sum(v["Total"] for v in counts_by_set.values())
    labels = [
        f"{s} ({v.get('Research Grade', 0)}/{v['Total']})"
        for s, v in counts_by_set.items()
    ]

    fig = go.Figure()
    for cat, color in [(cats[0], GREEN), (cats[1], YELLOW), (cats[2], "#bdc3c7")]:
        fig.add_trace(
            go.Bar(
                name=cat,
                y=labels,
                x=[v.get(cat, 0) for v in counts_by_set.values()],
                orientation="h",
                marker_color=color,
            )
        )
    fig.update_layout(
        title=f"Wingspan Set Coverage ({total_rg}/{total_all})",
        barmode="stack",
        xaxis_title="Bird Count",
        height=max(400, len(counts_by_set) * 45),
    )
    return fig


def render_needs_id_best_days(
    summary: ObservationSummary,
    best_days_needs_id: dict,
) -> None:
    min_date = datetime.date.today() - datetime.timedelta(days=30)
    nid_species = {species_name(t.name) for t in summary.needs_id_taxons}

    shown = False
    for day, species in sorted(best_days_needs_id.items(), reverse=True):
        if day < min_date or not species:
            continue
        shown = True
        tagged = []
        for sname, common in sorted(species):
            label = common if common else sname
            if sname in nid_species:
                label += " ⭐"
            tagged.append(label)
        with st.expander(f"{format_date(day)} — {len(species)} species"):
            st.write(", ".join(tagged))
    if not shown:
        st.info("No needs-ID species on best days in the last 30 days.")


st.set_page_config(page_title="iNat Graphs", layout="wide")
st.title("iNat Graphs")

with st.sidebar:
    st.header("Data")
    if st.button("Refresh Data"):
        st.cache_resource.clear()
        st.cache_data.clear()
        st.rerun()

summary, _observations = fetch_observations()

st.header("Lifetime Species by Iconic Taxon")
st.plotly_chart(lifetime_species_fig(summary), use_container_width=True)

st.divider()
st.header("Top Days by Unique Species")
top_days_figure, best_days_needs_id = top_days_fig(summary)
st.plotly_chart(top_days_figure, use_container_width=True)

st.divider()
st.header("Top Days by New Research Grade Species")
st.plotly_chart(new_species_days_fig(summary), use_container_width=True)

st.divider()
st.header("Top Localities by New Research Grade Species")
st.plotly_chart(localities_fig(summary), use_container_width=True)

st.divider()
st.header("New Needs-ID Species (last 30 days)")
rows = new_needs_id_rows(summary)
if rows:
    st.dataframe(rows, use_container_width=True, hide_index=True)
else:
    st.info("No new needs-ID species in the last 30 days.")

st.divider()
st.header("Needs-ID Species on Best Days (last month)")
render_needs_id_best_days(summary, best_days_needs_id)

st.divider()
st.header("Most Seen Research Grade Species")
st.plotly_chart(most_seen_fig(summary), use_container_width=True)

st.divider()
st.header("Wingspan Set Coverage")
st.plotly_chart(wingspan_coverage_fig(summary), use_container_width=True)
