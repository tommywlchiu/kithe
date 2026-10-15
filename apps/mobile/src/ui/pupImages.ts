import type { ImageSource } from 'expo-image';

import type { PupPose } from './PupArt';

// Fill in as Tommy's concept images arrive (docs/art/concept-prompts.md), for example:
// 'beagle-content': require('../../assets/pups/beagle-content.png'),
// Metro needs literal require() calls, so each image is listed by hand.
const images: Partial<Record<string, ImageSource>> = {};

export function pupImage(breed: string, pose: PupPose): ImageSource | undefined {
  return images[`${breed}-${pose}`];
}
