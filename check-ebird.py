#!/usr/bin/env python3

import fileinput
import csv

from utils import get_observations, species_name


def main():
    inat_observations, _ = get_observations()
    with fileinput.input() as ebird_csv_file:
        ebird_observations = csv.DictReader(ebird_csv_file)
        ebird_taxons = {
            obs["Scientific Name"]
            .replace(" (Domestic type)", "")
            .replace(" (Feral Pigeon)", ""): obs["Common Name"]
            for obs in ebird_observations
        }
        inat_taxons = {
            species_name(taxon.name): taxon.preferred_common_name
            for taxon in inat_observations.research_grade_taxons
            if taxon.iconic_taxon_name == "Aves"
        }
        inat_needs_id_taxons = {
            species_name(taxon.name) for taxon in inat_observations.needs_id_taxons
        }

        for taxon in ebird_taxons.keys() - inat_taxons.keys():
            needs_id = taxon in inat_needs_id_taxons
            print(
                f"Missing in iNaturalist:{' [NEEDS-ID]' if needs_id else ''} {ebird_taxons[taxon]} ({taxon})"
            )
        for taxon in inat_taxons.keys() - ebird_taxons.keys():
            print(f"      Missing in Ebird: {inat_taxons[taxon]} ({taxon})")


if __name__ == "__main__":
    main()
