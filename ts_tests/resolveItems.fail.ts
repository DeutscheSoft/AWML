import { DynamicValue, resolveItems } from '../src/index';

{
  const value: DynamicValue<number[]> = DynamicValue.fromConstant([1]);

  const value1: DynamicValue<string[]> = resolveItems(
    value,
    (item: number, index: number, list: number[]) => {
      return DynamicValue.fromConstant({});
    }
  );
}
