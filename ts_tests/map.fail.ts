import { DynamicValue, map } from '../src/index';

{
  const value = DynamicValue.fromConstant(0);

  const value2: DynamicValue<number> = map(
    value,
    (value: number) => value + ''
  );
}
