import {
  Component,
  ComponentRef,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
  ViewChild,
} from '@angular/core';
import { Observable, Subscription } from 'rxjs';
import { Definition } from './definition.interface';
import { SkafosDirective } from './skafos.directive';
import { SlangService, Val } from './slang.service';
import { Config, Vessel } from './vessels/vessel.interface';
import { vesselsNameMap } from './vessels/vessels-name-map';

import { isEqual } from 'lodash-es';

@Component({
    selector: 'lib-skafos',
    template: ` <ng-template libSkafosHost></ng-template> `,
    styles: [
        `
      :host {
        width: 100%;
        height: 100%;
      }
    `,
    ],
    imports: [SkafosDirective]
})
export class SkafosComponent implements OnChanges, OnDestroy {
  @Input()
  definition?: Definition;

  @Input()
  kstepSetter = (name: string, val: boolean): void => console.log('Skafos:', name, val);

  subs: Subscription[] = [];
  @ViewChild(SkafosDirective, { static: true }) skafosHost!: SkafosDirective;

  @Output()
  vesselOutputsEvent = new EventEmitter<Record<string, Val>>();

  vesselComponent?: ComponentRef<Vessel<Config>>;

  public skafosCommand(command: string): void {
    this.vesselComponent?.instance.commands$?.next(command);
  }
  constructor(private slang: SlangService) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['definition']?.currentValue !== null) {
      if (isEqual(changes['definition'].currentValue, changes['definition'].previousValue)) {
        return;
      }

      this.vesselComponent?.destroy();
      const { vessel, config, slangenv, ksteps } = changes['definition'].currentValue as Definition;

      if (vessel) {
        const vesselComponent = vesselsNameMap[vessel];
        const viewContainerRef = this.skafosHost.viewContainerRef;
        viewContainerRef.clear();

        const componentRef = viewContainerRef.createComponent<Vessel<Config>>(vesselComponent);
        componentRef.instance.config = JSON.parse(JSON.stringify(config)) ?? {};
        componentRef.instance.initialize?.(config);

        this.vesselComponent = componentRef;

        componentRef.instance.rendered$.subscribe({
          complete: () => {
            const outputs = componentRef.instance.outputs;
            this.vesselOutputsEvent.emit(outputs);
            Object.entries(outputs ?? {}).map(([name, obs]) => {
              this.slang.env[name] = obs;
            });

            if (slangenv) {
              slangenv.forEach((env) => this.slang.extendEnv(this.slang.env, env.name, env.exp));
            }
            if (ksteps) {
              ksteps.forEach((env) => {
                this.slang.extendEnv(this.slang.env, env.name, env.exp);
                const evaluation = this.slang.evaluate(env.name, this.slang.env);
                this.subs.push((evaluation as Observable<boolean>).subscribe((val) => this.kstepSetter(env.name, val)));
              });
            }

            this.skafosCommand('emitOutputs');
          },
        });
        this.subs.forEach((sub) => sub.unsubscribe());
      }
    }
  }

  ngOnDestroy(): void {
    this.slang.subs.forEach((sub) => sub.unsubscribe());
    this.subs.forEach((sub) => sub.unsubscribe());
  }
}
