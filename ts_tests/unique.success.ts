import { DynamicValue, unique } from '../src/index';

{
  const value = DynamicValue.fromConstant(0);

  const value2: DynamicValue<number> = unique(value);

  const value3: DynamicValue<number> = unique(value, (a: number, b: number) => a + b == 1);
}
