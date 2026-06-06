#!/usr/bin/env python3

import collections
import datetime
import json
import os
import logging

import pyinaturalist
import requests

from utils import get_observations, species_name

BEST_OF_BIRDING_ALBUM_ID = "c172ef8b-6f76-4abe-9ed5-cdd3292cc404"
BASE_URL = "https://photos.skc.name"
HEADERS = {
    "Accept": "application/json",
    "x-api-key": os.environ["IMMICH_API_KEY"],
}


def get_asset_tags(asset_id: str) -> list[str]:
    cache_path = os.path.expanduser(f"~/.immmich-cache/tags/{asset_id}.json")
    if os.path.exists(cache_path):
        with open(cache_path) as f:
            tags = json.load(f)
            if len(tags) > 0:
                return tags

    response = requests.get(f"{BASE_URL}/api/assets/{asset_id}", headers=HEADERS)
    response.raise_for_status()
    tags = [tag["value"] for tag in response.json()["tags"]]

    os.makedirs(os.path.dirname(cache_path), exist_ok=True)
    with open(cache_path, "w") as f:
        json.dump(tags, f)

    return tags


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)

    session = pyinaturalist.ClientSession()
    summary, _ = get_observations(session)
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

    assets_response = requests.get(
        f"{BASE_URL}/api/albums/{BEST_OF_BIRDING_ALBUM_ID}", headers=HEADERS
    )
    assets_response.raise_for_status()
    assets = assets_response.json()["assets"]

    counts = collections.defaultdict(lambda: collections.Counter())
    valid_classes = [
        "Male",
        "Female",
        "Indeterminate",
        "Immature",
        "Multiple",
    ]

    for asset in assets:
        tags = [t for t in get_asset_tags(asset["id"]) if t.startswith("Birding/")]
        owner = asset["originalPath"].split("/")[6]
        created = asset["fileCreatedAt"].split("T")[0]
        if len(tags) == 0:
            logging.warning(
                f"[{owner} / {created}] no birding tags -> {BASE_URL}/photos/{asset['id']}"
            )
            continue
        if len(tags) > 1:
            logging.warning(
                f"[{owner} / {created}] Multiple birding tags: {tags} -> {BASE_URL}/photos/{asset['id']}"
            )
            continue
        _, name, klass = tags[0].split("/")
        if klass not in valid_classes:
            logging.warning(
                f"[{owner} / {created}] Invalid class '{klass}' -> {BASE_URL}/photos/{asset['id']}"
            )
            continue
        counts[name][klass] += 1
        missing_species.discard(name)

    for name, c in counts.items():
        print(
            "\t".join(
                [
                    name,
                    species_by_name.get(name, ""),
                ]
                + [f"{c.get(klass, '')}" for klass in valid_classes]
            )
        )
    for name in missing_species:
        print(
            "\t".join(
                [
                    name,
                    species_by_name.get(name, ""),
                ]
            )
        )
