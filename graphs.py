#!/usr/bin/env python3

import collections
import datetime
import itertools
import json
import pyinaturalist
import termgraph

from utils import ObservationSummary, get_observations, species_name


def print_lifetime_unique_species_chart(
    summary: ObservationSummary,
):
    rg_species_by_iconic_taxon = dict(
        collections.Counter(
            taxon.iconic_taxon_name for taxon in summary.research_grade_taxons
        ).most_common()
    )
    needs_id_species_by_iconic_taxon = dict(
        collections.Counter(
            taxon.iconic_taxon_name for taxon in summary.needs_id_taxons
        ).most_common()
    )

    termgraph.BarChart(
        termgraph.Data(
            data=[
                [
                    rg_species_by_iconic_taxon[taxon],
                    needs_id_species_by_iconic_taxon.get(taxon, 0),
                ]
                for taxon in rg_species_by_iconic_taxon.keys()
            ],
            labels=list(rg_species_by_iconic_taxon.keys()),
            categories=[
                f"Research Grade ({sum(rg_species_by_iconic_taxon.values())})",
                f"Needs ID ({sum(needs_id_species_by_iconic_taxon.values())})",
            ],
        ),
        termgraph.Args(
            title="Lifetime Species by Iconic Taxon",
            colors=[termgraph.Colors.Green, termgraph.Colors.Yellow],
            format="{:<6.0f}",
            width=100,
        ),
    ).draw()


def print_day_unique_species_chart(
    summary: ObservationSummary,
):
    rg_species_by_day = {
        day: set((obs.taxon.name, obs.taxon.preferred_common_name) for obs in group)
        for day, group in itertools.groupby(
            sorted(
                summary.research_grade_observations,
                key=lambda obs: obs.observed_on.date(),
            ),
            key=lambda obs: obs.observed_on.date(),
        )
    }
    needs_id_species_by_day = {
        day: set((obs.taxon.name, obs.taxon.preferred_common_name) for obs in group)
        for day, group in itertools.groupby(
            sorted(
                summary.needs_id_observations, key=lambda obs: obs.observed_on.date()
            ),
            key=lambda obs: obs.observed_on.date(),
        )
    }
    for day in needs_id_species_by_day.keys():
        needs_id_species_by_day[day] -= rg_species_by_day.get(day, set())

    all_days = set(rg_species_by_day.keys()) | set(needs_id_species_by_day.keys())
    best_days = sorted(
        [
            (
                day,
                len(rg_species_by_day.get(day, set())),
                len(needs_id_species_by_day.get(day, set())),
                len(rg_species_by_day.get(day, set()))
                + len(needs_id_species_by_day.get(day, set())),
            )
            for day in all_days
        ],
        key=lambda x: (x[3], x[1]),
        reverse=True,
    )[:10]

    termgraph.BarChart(
        termgraph.Data(
            data=[
                [rg_species, needs_id_species]
                for _, rg_species, needs_id_species, _ in best_days
            ],
            labels=[str(day) for day, _, _, _ in best_days],
            categories=[
                "Research Grade",
                "Needs ID",
            ],
        ),
        termgraph.Args(
            title="Top Days by Unique Species Observed",
            colors=[termgraph.Colors.Green, termgraph.Colors.Yellow],
            format="{:<6.0f}",
            width=100,
        ),
    ).draw()

    return {
        entry[0]: needs_id_species_by_day.get(entry[0], set()) for entry in best_days
    }


def print_day_new_lifetime_species_chart(summary: ObservationSummary):
    new_species_by_day_and_iconic_taxon = collections.defaultdict(
        lambda: collections.Counter()
    )
    for obs in summary.first_research_observations:
        new_species_by_day_and_iconic_taxon[obs.observed_on.date()][
            obs.taxon.iconic_taxon_name
        ] += 1

    best_days = sorted(
        new_species_by_day_and_iconic_taxon.items(),
        key=lambda x: sum(x[1].values()),
        reverse=True,
    )[:10]
    represented_iconic_taxons = sorted(
        set(taxon for _, counts in best_days for taxon in counts.keys())
    )

    termgraph.StackedChart(
        termgraph.Data(
            data=[
                [counts.get(taxon, 0) for taxon in represented_iconic_taxons]
                for _, counts in best_days
            ],
            labels=[str(day) for day, _ in best_days],
            categories=represented_iconic_taxons,
        ),
        termgraph.Args(
            title="Top Days by New Research Grade Species Observed",
            colors=[
                termgraph.Colors.Green,
                termgraph.Colors.Red,
                termgraph.Colors.Blue,
                termgraph.Colors.Magenta,
                termgraph.Colors.Cyan,
            ],
            format="{:<6.0f}",
            width=100,
        ),
    ).draw()


def print_new_needs_id_species(summary: ObservationSummary):
    research_grade_species_taxons = set(
        species_name(taxon.name) for taxon in summary.research_grade_taxons
    )
    min_date = datetime.date.today() - datetime.timedelta(days=30)
    new_needs_id_species_observations = itertools.groupby(
        sorted(
            [
                obs
                for obs in summary.needs_id_observations
                if species_name(obs.taxon.name) not in research_grade_species_taxons
                and obs.observed_on.date() >= min_date
            ],
            key=lambda obs: obs.observed_on,
            reverse=True,
        ),
        key=lambda obs: species_name(obs.taxon.name),
    )

    print()
    print("# New Needs ID Species Observations (last 30 days)")
    print()
    for name, group in new_needs_id_species_observations:
        observations = list(group)
        print(
            f"{observations[0].taxon.emoji} {name}{f' ({observations[0].taxon.preferred_common_name})' if observations[0].taxon.preferred_common_name else ''}: "
            + f"{', '.join(sorted(set(str(obs.observed_on.date()) for obs in observations), reverse=True))}"
        )
    print()


def print_best_days_new_needs_id_species(
    summary: ObservationSummary,
    best_days_needs_id_species: dict[str, set[str]],
):
    min_date = datetime.date.today() - datetime.timedelta(days=30)
    needs_id_species = set(
        species_name(taxon.name) for taxon in summary.needs_id_taxons
    )
    print("# Needs ID Species for Best Days (last month)")
    print()
    for day, species in sorted(
        best_days_needs_id_species.items(), key=lambda d: d, reverse=True
    ):
        if day < min_date or not species:
            continue
        print(
            f"{day} ({len(species)}): "
            + ", ".join(
                (
                    f"{common_name if common_name else species_name}"
                    + (" ⭐" if species_name in needs_id_species else "")
                )
                for species_name, common_name in species
            )
        )


def print_most_seen_species(summary: ObservationSummary):
    species_observations = itertools.groupby(
        sorted(
            summary.research_grade_observations,
            key=lambda obs: obs.taxon.preferred_common_name,
        ),
        key=lambda obs: obs.taxon.preferred_common_name,
    )
    most_seen_species = sorted(
        [
            (species, set(obs.observed_on.date() for obs in observations))
            for species, observations in species_observations
        ],
        key=lambda x: len(x[1]),
        reverse=True,
    )[:5]

    termgraph.BarChart(
        termgraph.Data(
            data=[len(obs) for _, obs in most_seen_species],
            labels=[s for s, _ in most_seen_species],
        ),
        termgraph.Args(
            title="Most Seen Research Grade Species",
            format="{:<6.0f}",
            width=100,
        ),
    ).draw()


def print_locality_new_lifetime_species_chart(
    session: pyinaturalist.ClientSession, summary: ObservationSummary
):
    new_species_by_locality_and_iconic_taxon = collections.defaultdict(
        lambda: collections.Counter()
    )
    iconic_taxon_counts = collections.defaultdict(int)
    for obs in summary.first_research_observations:
        locality = pyinaturalist.get_places_by_id(obs.place_ids[1], session=session)[
            "results"
        ][0]["display_name"]
        new_species_by_locality_and_iconic_taxon[locality][
            obs.taxon.iconic_taxon_name
        ] += 1
        iconic_taxon_counts[obs.taxon.iconic_taxon_name] += 1

    best_localities = sorted(
        new_species_by_locality_and_iconic_taxon.items(),
        key=lambda x: sum(x[1].values()),
        reverse=True,
    )[:10]
    represented_iconic_taxons = sorted(
        iconic_taxon_counts.keys(),
        key=lambda taxon: iconic_taxon_counts[taxon],
        reverse=True,
    )

    termgraph.StackedChart(
        termgraph.Data(
            data=[
                [counts.get(taxon, 0) for taxon in represented_iconic_taxons]
                for _, counts in best_localities
            ],
            labels=[str(locality) for locality, _ in best_localities],
            categories=represented_iconic_taxons,
        ),
        termgraph.Args(
            title="Top Localities by New Research Grade Species Observed",
            colors=[
                termgraph.Colors.Green,
                termgraph.Colors.Red,
                termgraph.Colors.Blue,
                termgraph.Colors.Magenta,
                termgraph.Colors.Cyan,
                termgraph.Colors.Yellow,
                termgraph.Colors.Black,
                33,
            ],
            format="{:<6.0f}",
            width=100,
        ),
    ).draw()


def print_wingspan_set_coverage(summary: ObservationSummary):
    with open("wingspan-master.json") as wingspan_data_file:
        wingspan_data = json.load(wingspan_data_file)
    birds_by_set = {
        k: list(v)
        for (k, v) in itertools.groupby(
            sorted(wingspan_data, key=lambda w: w["Set"]), key=lambda w: w["Set"]
        )
    }
    research_grade_species = {t.name for t in summary.research_grade_taxons}
    needs_id_species = {t.name for t in summary.needs_id_taxons}

    def category_fn(bird):
        name = bird["Scientific name"]
        if name in research_grade_species:
            return "Research Grade"
        if name in needs_id_species:
            return "Needs ID"
        return "Missing"

    categories = [
        "Research Grade",
        "Needs ID",
        "Missing",
    ]

    counts_by_set = dict(
        sorted(
            {
                s: {
                    k: len(list(v))
                    for (k, v) in itertools.groupby(
                        sorted(birds, key=category_fn), key=category_fn
                    )
                }
                | {"Total": len(birds)}
                for s, birds in birds_by_set.items()
            }.items(),
            key=lambda i: i[1].get("Research Grade", 0),
            reverse=True,
        )
    )

    termgraph.StackedChart(
        termgraph.Data(
            data=[[v.get(c, 0) for c in categories] for v in counts_by_set.values()],
            labels=[
                f"{s:<11} ({v.get('Research Grade', 0):>2}/{v['Total']:>3})"
                for (s, v) in counts_by_set.items()
            ],
            categories=categories,
        ),
        termgraph.Args(
            title=f"Wingspan Set Coverage ({sum(v.get('Research Grade', 0) for v in counts_by_set.values())}/{sum(v['Total'] for v in counts_by_set.values())})",
            width=80,
            no_values=True,
            colors=[
                termgraph.Colors.Green,
                termgraph.Colors.Yellow,
                37,
            ],
        ),
    ).draw()


def main():
    session = pyinaturalist.ClientSession()
    summary, _ = get_observations(session)

    print_lifetime_unique_species_chart(summary)
    best_days_needs_id_species = print_day_unique_species_chart(summary)
    print_day_new_lifetime_species_chart(summary)
    print_locality_new_lifetime_species_chart(session, summary)
    print_new_needs_id_species(summary)
    print_best_days_new_needs_id_species(summary, best_days_needs_id_species)
    print_most_seen_species(summary)
    print_wingspan_set_coverage(summary)
    print()


if __name__ == "__main__":
    main()
