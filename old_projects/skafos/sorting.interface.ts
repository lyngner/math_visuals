import { ItemInterface } from '../../eikones.service';
import { Config } from '../vessel.interface';

export interface SortingConfig extends Config {
  items: Record<string, SortableItemInterface>;
  order: string[];
  direction: 'horizontal' | 'vertical' | true | 'true' | false | 'false';
  randomized?: boolean;
  gap?: number;
}

export interface SortableItemInterface extends ItemInterface {
  value: number;
}