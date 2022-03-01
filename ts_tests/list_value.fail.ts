import { DynamicValue, ListValue, combineLatest } from '../src/index';

{
  const n = DynamicValue.fromConstant(0);
  const str = DynamicValue.fromConstant('foo');

  ListValue.from(n, str).subscribe(([ b, a ]) => {
    console.log('%d, %o', a*2, b.split(''));
  });
}
