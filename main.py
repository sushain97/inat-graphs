#!/usr/bin/env python3

import collections
import dataclasses
import itertools
import pyinaturalist
import termgraph


@dataclasses.dataclass
class ObservationSummary:
    research_grade_observations: list[pyinaturalist.Observation]
    research_grade_taxons: set[pyinaturalist.Taxon]
    needs_id_observations: list[pyinaturalist.Observation]
    needs_id_taxons: set[pyinaturalist.Taxon]


def _species_name(name: str) -> str:
    if "×" in name:
        return name
    return " ".join(name.split(" ")[:2])


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
        key=lambda x: x[3],
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


def print_day_new_unique_species_chart(summary: ObservationSummary):
    seen_species = set()
    new_species_by_day_and_iconic_taxon = collections.defaultdict(
        lambda: collections.Counter()
    )
    iconic_taxons = set()
    for obs in sorted(
        summary.research_grade_observations, key=lambda obs: obs.observed_on.date()
    ):
        species_name = _species_name(obs.taxon.name)
        if species_name not in seen_species:
            seen_species.add(species_name)
            iconic_taxons.add(obs.taxon.iconic_taxon_name)
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
            title="Top Days by New Unique Species Observed",
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
        _species_name(taxon.name) for taxon in summary.research_grade_taxons
    )
    new_needs_id_species_observations = itertools.groupby(
        sorted(
            [
                obs
                for obs in summary.needs_id_observations
                if _species_name(obs.taxon.name) not in research_grade_species_taxons
            ],
            key=lambda obs: obs.observed_on,
            reverse=True,
        ),
        key=lambda obs: _species_name(obs.taxon.name),
    )

    print()
    print("# New Needs ID Species Observations")
    print()
    for species_name, group in new_needs_id_species_observations:
        observations = list(group)
        print(
            f"{observations[0].taxon.emoji} {species_name}{f' ({observations[0].taxon.preferred_common_name})' if observations[0].taxon.preferred_common_name else ''}: "
            + f"{', '.join(str(obs.observed_on.date()) for obs in observations)}"
        )
    print()


def print_best_days_new_needs_id_species(
    best_days_needs_id_species: dict[str, set[str]],
):
    print("# Needs ID Species for Best Days")
    print()
    for day, species in best_days_needs_id_species.items():
        if not species:
            continue
        print(
            f"{day} ({len(species)}): "
            + ", ".join(
                f"{common_name if common_name else species_name}"
                for species_name, common_name in species
            )
        )
    print()


def summarize_observations(
    observations: list[pyinaturalist.Observation],
) -> ObservationSummary:

    species_observations = [
        obs
        for obs in observations
        if obs.taxon.rank in ["species", "hybrid", "variety", "subspecies"]
    ]

    research_grade_observations = [
        obs for obs in species_observations if obs.quality_grade == "research"
    ]
    needs_id_observations = [
        obs for obs in species_observations if obs.quality_grade == "needs_id"
    ]

    research_grade_taxons = {
        _species_name(obs.taxon.name): obs.taxon for obs in research_grade_observations
    }
    needs_id_taxons = {
        _species_name(obs.taxon.name): obs.taxon
        for obs in needs_id_observations
        if _species_name(obs.taxon.name) not in research_grade_taxons
    }

    return ObservationSummary(
        research_grade_observations=research_grade_observations,
        research_grade_taxons=list(research_grade_taxons.values()),
        needs_id_observations=needs_id_observations,
        needs_id_taxons=list(needs_id_taxons.values()),
    )


def main():
    session = pyinaturalist.ClientSession()
    response = pyinaturalist.get_observations(
        user_id="sushain", session=session, page="all"
    )
    observations = pyinaturalist.Observation.from_json_list(response["results"])

    summary = summarize_observations(observations)

    print_lifetime_unique_species_chart(summary)
    best_days_needs_id_species = print_day_unique_species_chart(summary)
    print_day_new_unique_species_chart(summary)
    print_new_needs_id_species(summary)
    print_best_days_new_needs_id_species(best_days_needs_id_species)


if __name__ == "__main__":
    main()
