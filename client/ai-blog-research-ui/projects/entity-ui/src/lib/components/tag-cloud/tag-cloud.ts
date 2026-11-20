import { Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';

/** One tag in the cloud: its name, how many posts use it, where a click goes, and (admin only) where its edit screen is. */
export interface CloudTag {
  name: string;
  count: number;
  link: unknown[];
  editLink?: unknown[];
}

const smallest = 0.9;
const biggest = 2.4;

/** The font size in rem for a tag used <paramref name="count"/> times when the least used tag has <paramref name="min"/> uses and the most used <paramref name="max"/>. */
export function tagSize(count: number, min: number, max: number): number {
  if (max <= min) {
    return (smallest + biggest) / 2;
  }

  const share = (Math.max(count, min) - min) / (max - min);
  return Math.round((smallest + (biggest - smallest) * share) * 100) / 100;
}

/**
 * A tag cloud: the tags flow within their box, each sized by how much it is used (the way BlogEngine drew its cloud). Where a click
 * goes and whether a tag has an edit link are the host's say, so the public site and the admin share this one control.
 */
@Component({
  selector: 'adv-tag-cloud',
  imports: [RouterLink, MatIconModule],
  templateUrl: './tag-cloud.html',
  styleUrl: './tag-cloud.scss',
})
export class TagCloud {
  readonly tags = input.required<CloudTag[]>();

  protected readonly sized = computed(() => {
    const counts = this.tags().map((tag) => tag.count);
    const min = Math.min(...counts);
    const max = Math.max(...counts);
    return this.tags().map((tag) => ({ tag, size: tagSize(tag.count, min, max) }));
  });
}
