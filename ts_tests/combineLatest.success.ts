import { DynamicValue, ListValue, combineLatest } from '../src/index';

// Tuple case: combineLatest with explicit tuple of different types
{
  const n = DynamicValue.fromConstant(0);
  const str = DynamicValue.fromConstant('foo');

  const result: ListValue<[number, string]> = combineLatest([n, str]);

  result.subscribe(([a, b]) => {
    console.log('%d, %o', a * 2, b.split(''));
  });
}

// Tuple case: combineLatest with three values
{
  const n = DynamicValue.fromConstant(0);
  const str = DynamicValue.fromConstant('foo');
  const bool = DynamicValue.fromConstant(true);

  const result: ListValue<[number, string, boolean]> = combineLatest([n, str, bool]);

  result.subscribe(([a, b, c]) => {
    console.log('%d, %o, %o', a * 2, b.split(''), !c);
  });
}

// Array case: combineLatest with DynamicValue<T>[]
{
  const values: DynamicValue<number>[] = [
    DynamicValue.fromConstant(1),
    DynamicValue.fromConstant(2),
    DynamicValue.fromConstant(3),
  ];

  const result: ListValue<number[]> = combineLatest(values);

  result.subscribe((nums) => {
    console.log('%o', nums.map((n) => n * 2));
  });
}

// Array case: combineLatest with DynamicValue<string>[]
{
  const values: DynamicValue<string>[] = [
    DynamicValue.fromConstant('a'),
    DynamicValue.fromConstant('b'),
  ];

  const result: ListValue<string[]> = combineLatest(values);

  result.subscribe((strs) => {
    console.log('%o', strs.join(''));
  });
}

// Array case: dynamic array length
{
  const combine = (values: DynamicValue<number>[]): ListValue<number[]> => {
    return combineLatest(values);
  };

  const result = combine([
    DynamicValue.fromConstant(1),
    DynamicValue.fromConstant(2),
  ]);

  result.subscribe((nums) => {
    console.log('%o', nums.reduce((a, b) => a + b, 0));
  });
}
