#!/usr/bin/env python3

import collections
import itertools
import pyinaturalist
import termgraph


def _species_name(name: str) -> str:
    if "×" in name:
        return name
    return " ".join(name.split(" ")[:2])


def print_lifetime_unique_species_chart(
    species_observations: list[pyinaturalist.Observation],
):
    rg_species_observations = [
        obs for obs in species_observations if obs.quality_grade == "research"
    ]
    needs_id_species_observations = [
        obs for obs in species_observations if obs.quality_grade == "needs_id"
    ]

    rg_species_taxons = set(
        (_species_name(obs.taxon.name), obs.taxon.iconic_taxon_name)
        for obs in rg_species_observations
    )

    needs_id_species_taxons = (
        set(
            (_species_name(obs.taxon.name), obs.taxon.iconic_taxon_name)
            for obs in needs_id_species_observations
        )
        - rg_species_taxons
    )

    rg_species_by_iconic_taxon = dict(
        collections.Counter(taxon[1] for taxon in rg_species_taxons).most_common()
    )
    needs_id_species_by_iconic_taxon = dict(
        collections.Counter(taxon[1] for taxon in needs_id_species_taxons).most_common()
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
    species_observations: list[pyinaturalist.Observation],
):
    rg_species_observations = [
        obs for obs in species_observations if obs.quality_grade == "research"
    ]
    needs_id_species_observations = [
        obs for obs in species_observations if obs.quality_grade == "needs_id"
    ]

    rg_species_by_day = {
        day: set(obs.taxon.name for obs in group)
        for day, group in itertools.groupby(
            sorted(rg_species_observations, key=lambda obs: obs.observed_on.date()),
            key=lambda obs: obs.observed_on.date(),
        )
    }
    needs_id_species_by_day = {
        day: set(obs.taxon.name for obs in group)
        for day, group in itertools.groupby(
            sorted(
                needs_id_species_observations, key=lambda obs: obs.observed_on.date()
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


def print_day_new_unique_species_chart(
    species_observations: list[pyinaturalist.Observation],
):
    rg_species_observations = [
        obs for obs in species_observations if obs.quality_grade == "research"
    ]

    seen_species = set()
    new_species_by_day_and_iconic_taxon = collections.defaultdict(
        lambda: collections.Counter()
    )
    iconic_taxons = set()
    for obs in sorted(rg_species_observations, key=lambda obs: obs.observed_on.date()):
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


def print_new_needs_id_species(species_observations: list[pyinaturalist.Observation]):
    research_grade_species_taxons = set(
        _species_name(obs.taxon.name)
        for obs in species_observations
        if obs.quality_grade == "research"
    )
    new_needs_id_species_observations = itertools.groupby(
        sorted(
            [
                obs
                for obs in species_observations
                if obs.quality_grade == "needs_id"
                and _species_name(obs.taxon.name) not in research_grade_species_taxons
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
            f"{observations[0].taxon.emoji} {species_name}{f' ({observations[0].taxon.preferred_common_name})' if observations[0].taxon.preferred_common_name else ''}:"
        )
        for obs in observations:
            print(f"  {obs.observed_on.date()}")
        print()


def main():
    session = pyinaturalist.ClientSession(cache_file=".inat-cache.db")
    response = pyinaturalist.get_observations(
        user_id="sushain", session=session, page="all"
    )
    observations = pyinaturalist.Observation.from_json_list(response["results"])

    species_observations = [
        obs
        for obs in observations
        if obs.taxon.rank in ["species", "hybrid", "variety", "subspecies"]
    ]

    print_lifetime_unique_species_chart(species_observations)
    print_day_unique_species_chart(species_observations)
    print_day_new_unique_species_chart(species_observations)
    print_new_needs_id_species(species_observations)


if __name__ == "__main__":
    main()
