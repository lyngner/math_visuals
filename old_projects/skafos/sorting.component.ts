import {
  Component,
  ViewChild,
  ElementRef,
  AfterViewInit,
  OnDestroy,
  Injectable,
  ViewEncapsulation,
} from '@angular/core';
import { Subject, Subscription } from 'rxjs';

import { ItemType, Vessel } from '../vessel.interface';
import { SortableItemInterface, SortingConfig } from './sorting.interface';

import { Box, Svg, SVG, Matrix } from '@svgdotjs/svg.js';
import '@svgdotjs/svg.draggable.js';
import { scan, share } from 'rxjs/operators';
import { swapItems } from 'projects/grafo/src/app/shared/kinisi/kinisi-sortable.directive';
import { EikonesItem, EikonesService } from '../../eikones.service';
import { SpeechRuleEngineService } from 'projects/common/src/lib/speech-rule-engine.service';

enum Direction {
  UP,
  DOWN,
  LEFT,
  RIGHT,
}

declare global {
  interface Window {
    dragCount: number;
  }
}

window.dragCount = 0;

class SortableItem {
  public svgEl = this.vessel.svg
    .nested()
    .viewbox(0, 0, this.width, this.height)
    .width(this.width)
    .height(this.height)
    .attr({
      class: 'item',
    });

  public readonly eikones: EikonesItem;
  public readonly skia = document.createElement('li');
  public readonly button = document.createElement('button');
  public frame = this.svgEl.rect(this.width, this.height).center(this.width * 0.5, this.height * 0.5);

  private keyHandler = (event: KeyboardEvent) => {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      this.swapWith(-1, true, true);
    } else if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      this.swapWith(1, true, true);
    } else if (event.key === 'Enter') {
      this.handleEscape();
    }
  };

  constructor(
    public id: string,
    public itemConfig: SortableItemInterface,
    private vessel: Sorting,
    private width: number,
    private height: number
  ) {
    this.skia.appendChild(this.button);

    let scalingContext = '';
    switch (itemConfig.type) {
      case ItemType.Latex:
        scalingContext = 'latex';
        break;
      case ItemType.Text:
        scalingContext = 'text';
        break;
      case ItemType.Code:
        scalingContext = 'code';
        break;
    }

    this.eikones = this.vessel.eikones.renderItem(itemConfig, this.frame, this.button, scalingContext);
    this.registerListeners();
    this.vessel.skia.appendChild(this.skia);
  }

  handleEscape() {
    this.vessel.items.forEach((item) => {
      item.unsetCurrent();
      item.eikones.deactivate();
      document.removeEventListener('keydown', item.keyHandler);
    });
  }

  unsetCurrent() {
    this.svgEl.removeClass('current');
  }

  registerListeners() {
    const focus = () => {
      this.svgEl.addClass('focus');
    };

    const setCurrent = () => {
      this.svgEl.addClass('current');
    };

    const blur = () => {
      this.svgEl.removeClass('focus');
    };

    this.svgEl.draggable();
    this.eikones.draggable();

    this.svgEl.on('beforedrag', (event) => {
      if (window.dragCount > 0) {
        event.preventDefault();
        return;
      }
      window.dragCount += 1;
    });
    this.svgEl.on(
      'dragstart',
      () => {
        this.eikones.activate();
        this.svgEl.on('dragmove', this.produceSwapEventHandler());
      },
      { capture: true }
    );

    this.svgEl.on('dragend', () => {
      this.eikones.deactivate();
      this.snapInPlace();
      this.svgEl.off('dragmove');
      this.vessel.emitOutputs();
      window.dragCount -= 1;
    });

    this.button.addEventListener('focus', () => {
      focus();
    });

    this.button.addEventListener('click', () => {
      if (this.eikones.isTarget) {
        for (const item of this.vessel.items) {
          if (item.eikones.isActive) {
            item.placeBefore(this);
            this.vessel.items.forEach((item) => {
              item.eikones.deactivate();
              item.snapInPlace();
              this.vessel.emitOutputs();
            });
            break;
          }
        }

        this.handleEscape();
      } else {
        this.eikones.activate();
        this.vessel.items.filter((item) => item !== this).forEach((item) => item.eikones.makeTarget());
        document.addEventListener('keydown', this.keyHandler);

        this.vessel.items.filter((item) => item !== this).forEach((item) => item.unsetCurrent());
        setCurrent();
      }
    });

    this.button.addEventListener('blur', () => {
      blur();
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        this.handleEscape();
      }
    });
  }

  produceSwapEventHandler(): () => void {
    let moveBox = this.calculateSwapBox();
    return () => {
      const center = { x: this.svgEl.cx(), y: this.svgEl.cy() };
      if (center.y < moveBox.y) {
        this.move(Direction.UP);
        moveBox = this.calculateSwapBox();
      } else if (center.y > moveBox.y2) {
        this.move(Direction.DOWN);
        moveBox = this.calculateSwapBox();
      } else if (center.x > moveBox.x2) {
        this.move(Direction.RIGHT);
        moveBox = this.calculateSwapBox();
      } else if (center.x < moveBox.x) {
        this.move(Direction.LEFT);
        moveBox = this.calculateSwapBox();
      }
    };
  }

  move(dir: Direction): void {
    switch (dir) {
      case Direction.UP:
      case Direction.LEFT:
        this.swapWith(-1);
        return;

      case Direction.DOWN:
      case Direction.RIGHT:
        this.swapWith(1);
        return;
    }
  }

  placeBefore(item: SortableItem) {
    item.skia.before(this.skia);
    this.vessel.snapFromSkia();
  }

  swapWith(relIdx: number, snapOther = true, snapSelf = false) {
    const items = this.vessel.items;
    const idx = items.indexOf(this);
    const n = items.length;

    if (idx + relIdx < 0 || idx + relIdx >= n) {
      return;
    }

    [items[idx], items[idx + relIdx]] = [items[idx + relIdx], items[idx]];

    if (snapOther) {
      items[idx].snapInPlace();
    }

    if (snapSelf) {
      this.snapInPlace();
    }

    swapItems(items[idx].skia, items[idx + relIdx].skia);
  }

  calculateSnapCenter(): [x: number, y: number] {
    const idx = this.vessel.items.map((item) => item.skia).indexOf(this.skia);
    const [width, height] = [700, 500];

    const n = this.vessel.items.length;
    if (this.vessel.horizontal) {
      const d = width / n;
      return [(idx + 0.5) * d, height / 2];
    } else {
      const d = height / n;
      return [width / 2, (idx + 0.5) * d];
    }
  }

  calculateSwapBox(): Box {
    const [cx, cy] = this.calculateSnapCenter();
    const bbox = this.svgEl.bbox();
    const [w, h] = [bbox.w, bbox.h];
    const res = new Box(cx - w / 2, cy - h / 2, w, h).transform(new Matrix({ scale: 1.05 }));
    return res;
  }

  snapInPlace(): void {
    this.svgEl.animate(200, undefined, 'now').center(...this.calculateSnapCenter());
  }
}

@Injectable()
class Sorting {
  public items: SortableItem[] = [];
  public horizontal = true;
  public randomized = true;
  public config!: SortingConfig;
  private initialOrder?: string[];
  public skia = document.createElement('ol');

  public outputs: Record<string, Subject<any>> = {
    firstN: new Subject<number>(),
    lastN: new Subject<number>(),
    sorted: new Subject<boolean>(),
    almost: new Subject<boolean>(),
    order: new Subject<number[]>(),
  };

  public svg: Svg = SVG().viewbox(0, 0, 700, 500).width('100%').height('100%');
  public equationScale = new Subject<number>();
  public equationScalePipe = this.equationScale.pipe(
    scan((c, p) => Math.max(c, p), -Infinity),
    share()
  );

  public textScale = new Subject<number>();
  public textScalePipe = this.textScale.pipe(
    scan((c, p) => Math.min(c, p), Infinity),
    share()
  );

  constructor(public eikones: EikonesService, public sre: SpeechRuleEngineService) {}

  randomOrder(config: SortingConfig): string[] {
    if (config.order.length === 1) {
      return config.order;
    }
    const order = config.order.slice();
    do {
      order.sort(() => Math.random() - 0.5);
    } while (this.isSorted(order.map((i) => config['items'][i].value)));
    return order;
  }

  initialize(config: SortingConfig) {
    // some config.directions are true or false, due to an incorrect modernizing
    // when the we are sure that only "horizontal" and "vertical" exists in
    // the database, both this and the corresponding fix in the vessel can
    // be removed
    config.gap = this.getGap(config.gap);

    if (config.direction === false || config.direction === 'false') {
      config.direction = 'vertical';
    } else if (config.direction === true || config.direction === 'true') {
      config.direction = 'horizontal';
    }

    this.config = config;
    this.horizontal = config.direction === 'horizontal';
    this.randomized = config.randomized ?? true;

    const configItems = Object.entries(config.items);
    const n = configItems.length;
    const d = (this.horizontal ? 700 : 500) / n;

    if (n === 0) {
      return;
    }

    this.initialOrder = this.config.order;

    if (this.randomized) {
      this.initialOrder = this.randomOrder(config);
    }

    this.items = configItems.map(([id, item], _, items) => {
      const gap = this.getGap(config.gap);
      const newItem = new SortableItem(
        id,
        item,
        this,
        this.horizontal ? d - gap : 700,
        this.horizontal ? 500 : d - gap
      );
      return newItem;
    });

    this.placeItemsInOrder(this.initialOrder);
  }

  private getGap(gap: number | undefined): number {
    return gap ?? 10;
  }

  reset(): void {
    this.placeItemsInOrder(this.initialOrder!);
  }

  placeItemsInOrder(order: string[]) {
    this.items.forEach((item, idx) => {
      let orderIdx = order.indexOf(item.id);
      item.swapWith(orderIdx - idx, true, true);
    });
  }

  snapFromSkia() {
    const skias = Array.from(this.skia.querySelectorAll('li'));
    const newItems = this.items.slice();

    this.items.forEach((item) => {
      newItems[skias.indexOf(item.skia)] = item;
    });

    this.items = newItems.slice();
    this.items.forEach((item) => {
      item.snapInPlace();
    });
  }

  public emitOutputs(): void {
    const values = this.items.map((i) => Number(i.itemConfig.value));
    this.outputs['sorted'].next(this.isSorted(values));
    this.outputs['firstN'].next(this.firstN(values));
    this.outputs['lastN'].next(this.lastN(values));
    this.outputs['almost'].next(this.almost(values));
    this.outputs['order'].next(values);
  }

  firstN(arr: readonly number[]): number {
    const sorted = arr.slice().sort((a, b) => a - b);
    const n = sorted.length;

    for (let i = 0; i < n; i++) {
      if (arr[i] !== sorted[i]) {
        return i;
      }
    }
    return n;
  }

  lastN(arr: readonly number[]): number {
    const sorted = arr.slice().sort((a, b) => a - b);
    const n = sorted.length;

    for (let i = 0; i < n; i++) {
      if (arr[n - 1 - i] !== sorted[n - 1 - i]) {
        return i;
      }
    }
    return n;
  }

  isSorted(arr: readonly number[]): boolean {
    return this.firstN(arr) === arr.length;
  }

  sortedPairs(arr: readonly number[]): number {
    const N = arr.length;
    let n = 0;
    for (let i = 0; i < N - 1; i++) {
      for (let j = i + 1; j < N; j++) {
        n += arr[i] <= arr[j] ? 1 : 0;
      }
    }
    return n;
  }

  almost(arr: number[]): boolean {
    const N = arr.length;
    const pairs = (N * (N - 1)) / 2;
    const sortedPairs = this.sortedPairs(arr);

    return pairs - sortedPairs <= (N <= 5 ? 1 : 2);
  }

  destroy() {
    this.equationScale.complete();
    this.textScale.complete();
  }
}

@Component({
  selector: 'skafos-sorting',
  template: `
    <div class="skafos" #svgHost aria-hidden="true"></div>
    <div #skiaHost role="region" class="sr-only"></div>
  `,
  providers: [Sorting, EikonesService],
  styleUrls: ['../styles/skafos.scss'],
  encapsulation: ViewEncapsulation.None,
})
export class SortingComponent implements Vessel<SortingConfig>, AfterViewInit, OnDestroy {
  @ViewChild('svgHost') svgHost?: ElementRef<HTMLDivElement>;
  @ViewChild('skiaHost') skiaHost?: ElementRef<HTMLDivElement>;
  public rendered$ = new Subject<boolean>();
  public outputs = this.vessel.outputs;
  config!: SortingConfig;

  public commands$ = new Subject<string>();

  private subs = new Subscription();

  constructor(private vessel: Sorting) {}

  ngAfterViewInit(): void {
    this.vessel.svg.addTo(this.svgHost!.nativeElement);
    this.skiaHost?.nativeElement.appendChild(this.vessel.skia);

    this.vessel.initialize(this.config);
    this.rendered$.complete();

    this.subs.add(
      this.commands$.subscribe((command: string) => {
        switch (command) {
          case 'reset':
            this.vessel.reset();
            break;
          case 'emitOutputs':
            this.vessel.emitOutputs();
            break;
          default:
            console.error(`Unknown command: ${command}`);
        }
      })
    );
  }

  ngOnDestroy(): void {
    this.vessel.svg.remove();
    this.vessel.destroy();
    this.subs.unsubscribe();
    this.vessel.eikones.destroy();
  }
}
