import * as Path from 'path';

import {Validator} from '../library';

import {CASES_DIR} from './@constants';

const validatorGlobal = new Validator();

const validatorModule = new Validator({
  project: Path.join(CASES_DIR, 'module-type-case-1'),
});

it('should diagnose global types', () => {
  expect(validatorGlobal.diagnose('string', 'hello')).toMatchInlineSnapshot(
    `undefined`,
  );

  expect(
    validatorGlobal.diagnose("['hello', 'world']", ['hello', 'world']),
  ).toMatchInlineSnapshot(`undefined`);

  expect(
    validatorGlobal.diagnose('{foo: string; bar: number}', {
      foo: 'abc',
      bar: 123,
    }),
  ).toMatchInlineSnapshot(`undefined`);

  expect(validatorGlobal.diagnose('string', 123)).toMatchInlineSnapshot(`
    Array [
      "Diagnostic value path: (root)
      Type 'number' is not assignable to type 'string'.",
    ]
  `);

  expect(validatorGlobal.diagnose('string[]', ['hello', 'world', 1]))
    .toMatchInlineSnapshot(`
    Array [
      "Diagnostic value path: [2]
      Type 'number' is not assignable to type 'string'.",
    ]
  `);

  expect(validatorGlobal.diagnose("['hello', 'world']", ['hello', 'tiva']))
    .toMatchInlineSnapshot(`
    Array [
      "Diagnostic value path: [1]
      Type '\\"tiva\\"' is not assignable to type '\\"world\\"'.",
    ]
  `);

  expect(
    validatorGlobal.diagnose('{foo: string; bar: number}', {
      foo: 123,
      bar: 'abc',
    }),
  ).toMatchInlineSnapshot(`
    Array [
      "Diagnostic value path: [\\"foo\\"]
      Type 'number' is not assignable to type 'string'.",
      "Diagnostic value path: [\\"bar\\"]
      Type 'string' is not assignable to type 'number'.",
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
      "Diagnostic value path: [\\"conditional\\"][\\"conditionRight\\"]
      Type '{ conditionRight: number; }' is not assignable to type '{ conditionLeft: string; }'.
        Object literal may only specify known properties, and '\\"conditionRight\\"' does not exist in type '{ conditionLeft: string; }'.",
      "Diagnostic value path: [\\"array\\"][1]
      Type 'number' is not assignable to type 'string'.",
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
      "Diagnostic value path: [\\"mapping\\"]
      Property 'hello' is missing in type '{ world: false; }' but required in type 'Mapping<\\"hello\\" | \\"world\\", boolean>'.",
      "Diagnostic value path: [\\"tuple\\"][2]
      Type '\\"mismatch\\"' is not assignable to type '\\"literal\\"'.",
    ]
  `);
});
