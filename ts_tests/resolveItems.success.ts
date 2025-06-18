import { DynamicValue, resolveItems } from '../src/index';

{
  const value: DynamicValue<number[]> = DynamicValue.fromConstant([1]);

  const value1: DynamicValue<string[]> = resolveItems(
    value,
    (item: number, index: number, list: number[]) => {
      return DynamicValue.fromConstant('foobar');
    }
  );
}

{
  // Set
  const value = DynamicValue.fromConstant(new Set<number>([1]));

  const value1: DynamicValue<Set<string>> = resolveItems(
    value,
    (item, index, list) => {
      return DynamicValue.fromConstant('foobar' + item * 2);
    }
  );
}

{
  // Map
  const value = DynamicValue.fromConstant(
    new Map<string, number>([['foo', 1]])
  );

  const value1: DynamicValue<Map<string, string>> = resolveItems(
    value,
    (item, index, list) => {
      return DynamicValue.fromConstant('foobar' + item * 2);
    }
  );
}
