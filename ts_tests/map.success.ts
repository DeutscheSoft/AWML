import { DynamicValue, map } from '../src/index';

{
  const value = DynamicValue.fromConstant(0);

  const value2: DynamicValue<number> = map(value, (value: number) => value * 2);

  const value3: DynamicValue<number> = map(value, (value: number) => value * 2, (value) => value / 2);

  const value4: DynamicValue<number> = map(value, (value) => value * 2, (value) => value / 2);
}

{
  const value = DynamicValue.fromConstant('foobar');

  const value1: DynamicValue<number> = map(value, (value) => value.length);
}

{
  const value = new DynamicValue<number[]>();

  const value1: DynamicValue<string> = map(value, (list) => list.join(''));
}
