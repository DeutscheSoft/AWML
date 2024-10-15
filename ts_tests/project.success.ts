import { createProjectionContext, DynamicValue, project } from '../src/index';

{
  const value = DynamicValue.fromConstant({ x: 0, y: 0 });

  const x = project(
    value,
    ({ x }) => x,
    (point, x) => ({ x, y: point.y })
  );
}

{
  const [value, ctx] = createProjectionContext(
    DynamicValue.fromConstant({ x: 0, y: 0 })
  );

  const x = project(
    value,
    ({ x }) => x,
    (point, x) => ({ x, y: point.y }),
    ctx
  );
  const y = project(
    value,
    ({ y }) => y,
    (point, y) => ({ x: point.x, y }),
    ctx
  );
}
