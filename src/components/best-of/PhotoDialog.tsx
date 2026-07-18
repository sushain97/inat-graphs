"use client";

import { useState } from "react";
import {
  Anchor,
  Image,
  Modal,
  SimpleGrid,
  Skeleton,
  Stack,
  Title,
} from "@mantine/core";
import {
  BEST_OF_CLASSES,
  type BestOfClass,
} from "@/lib/immich/best-of-classes";

const CLASS_LABELS: Partial<Record<BestOfClass, string>> = {
  Male: "Male (♂)",
  Female: "Female (♀)",
  Immature: "Immature (⚲)",
};

const THUMBNAIL_ASPECT_RATIO = "3 / 2";

function Thumbnail({ assetId, alt }: { assetId: string; alt: string }) {
  const [loaded, setLoaded] = useState(false);

  return (
    <div style={{ position: "relative", aspectRatio: THUMBNAIL_ASPECT_RATIO }}>
      {!loaded && <Skeleton height="100%" width="100%" radius="sm" />}
      <Image
        src={`/api/thumbnail/${assetId}`}
        alt={alt}
        radius="sm"
        onLoad={() => setLoaded(true)}
        style={{
          position: "absolute",
          inset: 0,
          height: "100%",
          width: "100%",
          objectFit: "cover",
          visibility: loaded ? "visible" : "hidden",
        }}
      />
    </div>
  );
}

export interface PhotoDialogProps {
  opened: boolean;
  onClose: () => void;
  name: string;
  commonName: string;
  immichBaseUrl: string;
  speciesPhotos: Partial<Record<BestOfClass, string[]>>;
}

export function PhotoDialog({
  opened,
  onClose,
  name,
  commonName,
  immichBaseUrl,
  speciesPhotos,
}: PhotoDialogProps) {
  const classesWithPhotos = BEST_OF_CLASSES.filter(
    (klass) => (speciesPhotos[klass]?.length ?? 0) > 0,
  );

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      size="xl"
      title={commonName ? `${commonName} (${name})` : name}
    >
      <Stack gap="md">
        {classesWithPhotos.map((klass) => (
          <Stack key={klass} gap="xs">
            <Title order={5}>{CLASS_LABELS[klass] ?? klass}</Title>
            <SimpleGrid cols={3}>
              {speciesPhotos[klass]!.map((assetId) => (
                <Anchor
                  key={assetId}
                  href={`${immichBaseUrl}/photos/${assetId}`}
                  target="_blank"
                >
                  <Thumbnail assetId={assetId} alt={`${name} photo`} />
                </Anchor>
              ))}
            </SimpleGrid>
          </Stack>
        ))}
      </Stack>
    </Modal>
  );
}
