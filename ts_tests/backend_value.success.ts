import { getBackendValue } from '../src/index';

{
  getBackendValue('foo:bar').set(234);
  getBackendValue<number>('foo:bar').set(234);
  getBackendValue<number>('foo:bar').subscribe((value: number) => {
    console.log('value:', value * 2);
  });
  getBackendValue<string>('foo:bar').subscribe((value: string) => {
    console.log('value:', value);
  });
}

{
  const run = async () => {
    const n: number = await getBackendValue<number>('foo:bar').wait();
    const str: string = await getBackendValue<string>('foo:bar').wait();
  };
}
