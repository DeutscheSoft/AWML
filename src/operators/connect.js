/**
 * Connects two dynamic values to each other. Values emitted by
 * one will be set() on the other. Note that this method will detect
 * recursions break them.
 *
 * @param {DynamicValue} value1
 *      The first value.
 * @param {boolean} [replay1=true]
 *      Passed as second argument to :class:`value1.subscribe() <DynamicValue>`.
 * @param {function} [transform1]
 *      Optional transformation function for values passed from ``value1`` to
 *      ``value2``.
 * @param {DynamicValue} value2
 *      The second value.
 * @param {boolean} [replay2=true]
 *      Passed as second argument to :class:`value2.subscribe() <DynamicValue>`.
 * @param {function} [transform2]
 *      Optional transformation function for values passed from ``value2`` to
 *      ``value1``.
 *
 * @returns {function}
 *      Returns a subscription. When called, the connection between
 *      the two dynamic values will be removed.
 */
export function connect(
  value1,
  replay1,
  transform1,
  value2,
  replay2,
  transform2
) {
  let rec = 0;

  const sub1 = value1.subscribe((value) => {
    if (rec > 1) return;
    rec++;
    try {
      if (transform1) value = transform1(value);
      value2.set(value);
    } finally {
      rec--;
    }
  }, replay1);

  const sub2 = value2.subscribe((value) => {
    if (rec > 1) return;
    rec++;
    try {
      if (transform2) value = transform2(value);
      value1.set(value);
    } finally {
      rec--;
    }
  }, replay2);

  return () => {
    sub1();
    sub2();
  };
}

/**
 * Connects the output of one dynamic value to the input of
 * another.
 *
 * @param {DynamicValue} to
 *      The destination of the connection. Values emitted by the value ``from``
 *      will be :class:`set() <DynamicValue>` on ``to``.
 * @param {DynamicValue} from
 *      The source of the connection.
 * @param {boolean} [replay=true]
 *      Passed as second argument to :class:`subscribe <DynamicValue>`.
 * @param {function} [transform]
 *      Optional transformation function for values passed from ``from`` to
 *      ``to``.
 *
 * @returns {function}
 *      Returns a subscription. When called, the connection between
 *      the two dynamic values will be removed.
 */
export function connectTo(to, from, replay, transform) {
  return from.subscribe((value) => {
    if (transform) value = transform(value);
    to.set(value);
  }, replay);
}
