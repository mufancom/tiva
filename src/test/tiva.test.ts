import {Tiva} from '../../bld/library';

let tiva = new Tiva();

it('should validate', async () => {
  await expect(tiva.validate('string[]', ['abc'])).resolves.toBeUndefined();

  await expect(tiva.validate('string[]', [1])).rejects.toMatchInlineSnapshot(
    `[ValidateError: Type validation failed]`,
  );
});

it('should test', async () => {
  await expect(tiva.test('string[]', ['abc'])).resolves.toBe(true);

  await expect(tiva.test('string[]', [1])).resolves.toBe(false);
});

it('should diagnose', async () => {
  await expect(
    tiva.diagnose('string[]', ['abc']),
  ).resolves.toMatchInlineSnapshot(`undefined`);

  await expect(tiva.diagnose('string[]', [1])).resolves.toMatchInlineSnapshot(`
          Array [
            "Diagnostic value path: [0]
            Type 'number' is not assignable to type 'string'.",
          ]
        `);
});

it('should error', async () => {
  await expect(
    tiva.diagnose(
      `\
{
  /** @pattern */
  xxx: string;
}`,
      {xxx: 'abc'},
    ),
  ).rejects.toMatchInlineSnapshot(
    `[Error: A regular expression pattern is required for extension \`@pattern\`]`,
  );
});
