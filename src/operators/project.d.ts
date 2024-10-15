import { DynamicValue } from '../dynamic_value';

export type ProjectionContext<T> =
  | {
      hasValue: false;
      value: undefined;
    }
  | {
      hasValue: true;
      value: T;
    };

/**
 * Function to create projections contexts. Projection contexts are used
 * to create several different projections of the same dynamic value. The
 * projection context makes sure that different projected dynamic values
 * to not interfer with each other.
 *
 * @param dv The input dynamic value to create a projection context for.
 */
export function createProjectionContext<T>(
  dv: DynamicValue<T>
): [DynamicValue<T>, ProjectionContext<T>];

/**
 * Transform the input dynamic value using a projection. This can be used to
 * create a dynamic value which represents one field inside of the data in
 * another dynamic value.
 *
 * When creating several projections of the same input data it is best to
 * use a shared projection context. Otherwise, setting values on the different
 * projections at the same time will interfer with eachother.
 *
 * @param dv The input dynamic value.
 * @param projection A projection function, e.g. a function which returns an entry from the input data.
 * @param merge An (optional) merge function which can be used to transform back.
 * @param context An (optional) projection context. Can be created using `createProjectionContext`.
 */
export function project<T, R>(
  dv: DynamicValue<T>,
  projection: (value: T) => R,
  merge: (value: T, change: R) => T,
  context?: ProjectionContext<T>
): DynamicValue<R>;
