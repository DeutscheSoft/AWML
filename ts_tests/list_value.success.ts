import { DynamicValue, ListValue, combineLatest } from '../src/index';

{
  const n = DynamicValue.fromConstant(0);
  const str = DynamicValue.fromConstant('foo');

  ListValue.from(n, str).subscribe(([a, b]) => {
    console.log('%d, %o', a * 2, b.split(''));
  });

  new ListValue<[number, string]>([n, str]).subscribe(([a, b]) => {
    console.log('%d, %o', a * 2, b.split(''));
  });

  combineLatest([n, str]).subscribe(([a, b]) => {
    console.log('%d, %o', a * 2, b.split(''));
  });
}
