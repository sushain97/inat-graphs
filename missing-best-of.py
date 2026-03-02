import datetime
import fileinput

from utils import get_observations, species_name


def main():
    summary, _ = get_observations()
    included_species = set(line.strip() for line in fileinput.input())
    expected_species = set(
        (
            observation.taxon.parent.preferred_common_name
            if observation.taxon.rank == "subspecies"
            else observation.taxon.preferred_common_name
        )
        or species_name(observation.taxon.name)
        for observation in summary.research_grade_observations
        if observation.quality_grade == "research"
        and observation.taxon.iconic_taxon_name
        not in ["Fungi", "Arachnida", "Insecta", "Mollusca"]
        and observation.observed_on.date() >= datetime.date(2025, 10, 8)
    )
    for species in sorted(expected_species - included_species):
        print(species)


if __name__ == "__main__":
    main()
