import { DynamicValue, combineLatest } from '../src/index';

// Tuple case: wrong type order - a is number, b is string
{
  const n = DynamicValue.fromConstant(0);
  const str = DynamicValue.fromConstant('foo');

  combineLatest([n, str]).subscribe(([a, b]) => {
    console.log('%o', a.split(''));
    console.log('%d', b * 2);
  });
}
