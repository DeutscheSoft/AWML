/**
 * Connects two dynamic values to each other. Values emitted by
 * one will be set() on the other.
 */
export function connect(
  value1,
  replay1,
  transform1,
  value2,
  replay2,
  transform2
) {
  let rec = false;

  const sub1 = value1.subscribe((value) => {
    if (rec) return;
    rec = true;
    try {
      if (transform1) value = transform1(value);
      value2.set(value);
    } catch (err) {
      throw err;
    } finally {
      rec = false;
    }
  }, replay1);

  const sub2 = value2.subscribe((value) => {
    if (rec) return;
    rec = true;
    try {
      if (transform2) value = transform2(value);
      value1.set(value);
    } catch (err) {
      throw err;
    } finally {
      rec = false;
    }
  }, replay2);

  return () => {
    sub1();
    sub2();
  };
}
