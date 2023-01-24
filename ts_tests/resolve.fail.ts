import { DynamicValue, resolve } from '../src/index';

{
  const value: DynamicValue<number> = DynamicValue.fromConstant(0);

  const value1: DynamicValue<string> = resolve(value, (value: number) =>
    Promise.resolve(value)
  );
}
