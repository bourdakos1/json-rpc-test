// @ts-check
const fs = require("fs");
const { initialize, validate } = require("./validate");

/**
 * @param {string} name
 */
async function testPipeline(name) {
  const content = fs.readFileSync(`./${name}.pipeline`, {
    encoding: "utf-8",
  });
  const res = await validate(content);
  const { diagnostics } = res.params;
  console.log(`Pipeline "${name}" has ${diagnostics.length} problems`);
  for (const d of diagnostics) {
    console.log(`- ${d.message}`);
  }
  console.log();
}

async function main() {
  await initialize();
  await testPipeline("circle");
  await testPipeline("good");
  await testPipeline("missing-prop");
}

main();
