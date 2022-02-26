import { DynamicValue } from '../dynamic_value';

export function fromDOMEvent(
  eventTarget: EventTarget,
  eventName: string,
  preventDefault?: boolean,
  stopPropagation?: boolean
): DynamicValue<Event>;
