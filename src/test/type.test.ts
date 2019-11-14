import * as Path from 'path';

import {Validator} from '../../bld/library';

let validatorGlobal = new Validator();

let validatorModule = new Validator({
  project: Path.join(__dirname, 'cases/module-type-case-1'),
});

it('should diagnose global types', () => {
  expect(
    validatorGlobal.diagnose('string[]', ['hello', 'world']),
  ).toMatchInlineSnapshot(`undefined`);

  expect(
    validatorGlobal.diagnose("['hello', 'world']", ['hello', 'world']),
  ).toMatchInlineSnapshot(`undefined`);

  expect(
    validatorGlobal.diagnose('{foo: string; bar: number}', {
      foo: 'abc',
      bar: 123,
    }),
  ).toMatchInlineSnapshot(`undefined`);

  expect(validatorGlobal.diagnose('string[]', ['hello', 'world', 1]))
    .toMatchInlineSnapshot(`
          Array [
            "Type 'number' is not assignable to type 'string'.",
          ]
        `);

  expect(validatorGlobal.diagnose("['hello', 'world']", ['hello', 'tiva']))
    .toMatchInlineSnapshot(`
          Array [
            "Type '\\"tiva\\"' is not assignable to type '\\"world\\"'.",
          ]
        `);

  expect(
    validatorGlobal.diagnose('{foo: string; bar: number}', {
      foo: 123,
      bar: 'abc',
    }),
  ).toMatchInlineSnapshot(`
          Array [
            "Type 'number' is not assignable to type 'string'.",
            "Type 'string' is not assignable to type 'number'.",
          ]
        `);
});

it('should diagnose module types', async () => {
  expect(
    validatorModule.diagnose(
      {
        module: '.',
        type: 'Root',
      },
      {
        conditional: {
          conditionLeft: 'abc',
        },
        mapping: {
          hello: true,
          world: false,
        },
        array: ['hello', 'world'],
        tuple: ['hello', true, 'literal'],
      },
    ),
  ).toMatchInlineSnapshot(`undefined`);

  expect(
    validatorModule.diagnose(
      {
        module: '.',
        type: 'Root',
      },
      {
        conditional: {
          conditionRight: 123,
        },
        mapping: {
          hello: true,
          world: false,
        },
        array: ['hello', 1],
        tuple: ['hello', true, 'literal'],
      },
    ),
  ).toMatchInlineSnapshot(`
          Array [
            "Object literal may only specify known properties, and '\\"conditionRight\\"' does not exist in type '{ conditionLeft: string; }'.",
            "Type 'number' is not assignable to type 'string'.",
          ]
        `);

  expect(
    validatorModule.diagnose(
      {
        module: '.',
        type: 'Root',
      },
      {
        conditional: {
          conditionLeft: 'abc',
        },
        mapping: {
          world: false,
        },
        array: ['hello', 'world'],
        tuple: ['hello', true, 'mismatch'],
      },
    ),
  ).toMatchInlineSnapshot(`
          Array [
            "Property 'hello' is missing in type '{ world: false; }' but required in type 'Mapping<\\"hello\\" | \\"world\\", boolean>'.",
            "Type '\\"mismatch\\"' is not assignable to type '\\"literal\\"'.",
          ]
        `);
});
