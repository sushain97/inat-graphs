import dataclasses

import pyinaturalist


def species_name(name: str) -> str:
    if "×" in name:
        return name
    return " ".join(name.split(" ")[:2])


@dataclasses.dataclass
class ObservationSummary:
    research_grade_observations: list[pyinaturalist.Observation]
    research_grade_taxons: set[pyinaturalist.Taxon]
    first_research_observations: list[pyinaturalist.Observation]
    needs_id_observations: list[pyinaturalist.Observation]
    needs_id_taxons: set[pyinaturalist.Taxon]


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
        species_name(obs.taxon.name): obs.taxon for obs in research_grade_observations
    }
    needs_id_taxons = {
        species_name(obs.taxon.name): obs.taxon
        for obs in needs_id_observations
        if species_name(obs.taxon.name) not in research_grade_taxons
    }

    seen_species = set()
    first_research_observations = []
    for obs in sorted(
        research_grade_observations, key=lambda obs: obs.observed_on.date()
    ):
        name = species_name(obs.taxon.name)
        if name not in seen_species:
            seen_species.add(name)
            first_research_observations.append(obs)

    return ObservationSummary(
        research_grade_observations=research_grade_observations,
        research_grade_taxons=list(research_grade_taxons.values()),
        first_research_observations=first_research_observations,
        needs_id_observations=needs_id_observations,
        needs_id_taxons=list(needs_id_taxons.values()),
    )


def get_observations(session):
    response = pyinaturalist.get_observations(
        user_id="sushain", session=session, page="all"
    )
    observations = pyinaturalist.Observation.from_json_list(response["results"])

    return [summarize_observations(observations), observations]
