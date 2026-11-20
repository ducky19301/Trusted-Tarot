const test = require("node:test");
const assert = require("node:assert/strict");
const curriculum = require("../../web/astro-curriculum.js");

test("astrology curriculum has broad topic coverage and multiple complete lessons per topic", () => {
  assert.ok(curriculum.topics.length >= 12);
  for (const topic of curriculum.topics) {
    assert.ok(topic.title && topic.summary, topic.id);
    assert.ok(topic.lessons.length >= 3, topic.id);
    for (const lesson of topic.lessons) {
      assert.ok(lesson.title && lesson.body.length >= 3 && lesson.example, topic.id + "/" + lesson.title);
      assert.ok(lesson.quiz.length >= 2, topic.id + "/" + lesson.title);
      for (const q of lesson.quiz) {
        assert.ok(q[0] && q[1].length >= 2 && Number.isInteger(q[2]) && q[2] >= 0 && q[2] < q[1].length && q[3], topic.id + "/" + lesson.title);
      }
    }
  }
});

test("curriculum includes all ten planetary functions, twelve signs and twelve houses", () => {
  assert.deepEqual(Object.keys(curriculum.planets), ["Sun","Moon","Mercury","Venus","Mars","Jupiter","Saturn","Uranus","Neptune","Pluto"]);
  assert.equal(Object.keys(curriculum.signs).length, 12);
  assert.equal(Object.keys(curriculum.houses).length, 12);
  assert.ok(curriculum.aspects.length >= 5);
  assert.ok(curriculum.numerology.length >= 6);
});

test("every lesson has fully authored quiz questions with answer explanations", () => {
  const lessons = curriculum.topics.flatMap(t => t.lessons);
  assert.ok(lessons.length >= 36);
  assert.ok(lessons.every(l => l.quiz.every(q => typeof q[3] === "string" && q[3].length > 15)));
});
