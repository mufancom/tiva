import * as Path from 'path';

import {Validator} from '../../bld/library';

let validatorGlobal = new Validator({
  project: Path.join(__dirname, 'cases/extensions-case-1'),
  compilerOptions: {
    strict: true,
    types: ['./index'],
  },
});

let validatorModule = new Validator({
  project: Path.join(__dirname, 'cases/extensions-case-2'),
  extensions: {
    custom(value) {
      return value === 'custom'
        ? undefined
        : `Value "${value}" must be "custom"`;
    },
  },
});

it('should diagnose extensions defined in global types', () => {
  expect(
    validatorGlobal.diagnose('Patterns', {
      mention: 'Yoha @you.',
      number: '123',
      maybeNumber: 123,
      uuid: 'b53d75e5-b431-46c8-89ef-de6d45608cce',
      maybeUUID: 123,
      uuidAll: 'b53d75e5-b431-46c8-89ef-de6d45608cce',
      uuid4: 'a89439c1-e4bf-4b2d-8118-c7f752ab7842',
    }),
  ).toMatchInlineSnapshot(`undefined`);

  expect(
    validatorGlobal.diagnose('Patterns', {
      mention: 'nope',
      number: 'x123',
      maybeNumber: 'x456',
      uuid: 'invalid',
      maybeUUID: 'invalid',
      uuidAll: 'invalid',
      uuid4: 'invalid',
    }),
  ).toMatchInlineSnapshot(`
    Array [
      "Diagnostic value path: [\\"mention\\"]
      Value \\"nope\\" does not match pattern @\\\\w+",
      "Diagnostic value path: [\\"number\\"]
      Value \\"x123\\" does not match pattern ^\\\\d+$",
      "Diagnostic value path: [\\"maybeNumber\\"]
      Value \\"x456\\" does not match pattern ^\\\\d+$",
      "Diagnostic value path: [\\"uuid\\"]
      Value \\"invalid\\" is not a valid UUID",
      "Diagnostic value path: [\\"maybeUUID\\"]
      Value \\"invalid\\" is not a valid UUID",
      "Diagnostic value path: [\\"uuidAll\\"]
      Value \\"invalid\\" is not a valid UUID",
      "Diagnostic value path: [\\"uuid4\\"]
      Value \\"invalid\\" is not a valid UUID (v4)",
    ]
  `);

  expect(() => {
    validatorGlobal.diagnose('InvalidPatterns', {
      xxx: '',
    });
  }).toThrowErrorMatchingInlineSnapshot(
    `"A regular expression pattern is required for extension \`@pattern\`"`,
  );
});

it('should diagnose extensions defined in module types', () => {
  expect(
    validatorModule.diagnose(
      {
        module: '.',
        type: 'Patterns',
      },
      {
        mention: 'Yoha @you.',
        number: '123',
        custom: 'custom',
        subs: [
          {
            id: 'fff',
            value: 'fff',
          },
          {
            id: 'zzz',
            value: 'xxx',
            value2: 'yyy',
          },
        ],
      },
    ),
  ).toMatchInlineSnapshot(`undefined`);

  expect(
    validatorModule.diagnose(
      {
        module: '.',
        type: 'Patterns',
      },
      {
        mention: 'nope',
        number: 'x123',
        custom: 'yoha',
        subs: [
          {
            id: '@#$',
            value: ' ',
          },
          {
            id: 'fff',
            value: 'xxx',
          },
          {
            id: 'fff',
            value: 'xxx',
            value2: 'xxx',
          },
        ],
      },
    ),
  ).toMatchInlineSnapshot(`
    Array [
      "Diagnostic value path: [\\"mention\\"]
      Value \\"nope\\" does not match pattern @\\\\w+",
      "Diagnostic value path: [\\"number\\"]
      Value \\"x123\\" does not match pattern ^\\\\d+$",
      "Diagnostic value path: [\\"custom\\"]
      Value \\"yoha\\" must be \\"custom\\"",
      "Diagnostic value path: [\\"subs\\"][0][\\"id\\"]
      Value \\"@#$\\" does not match pattern ^\\\\w+$",
      "Diagnostic value path: [\\"subs\\"][2][\\"id\\"]
      Duplicate value \\"fff\\"",
      "Diagnostic value path: [\\"subs\\"][0][\\"value\\"]
      Value \\" \\" does not match pattern ^\\\\S+$",
      "Diagnostic value path: [\\"subs\\"][2][\\"value\\"]
      Duplicate sub-value \\"xxx\\"",
      "Diagnostic value path: [\\"subs\\"][2][\\"value2\\"]
      Duplicate sub-value \\"xxx\\"",
    ]
  `);
});
