# AI Policy

AI tools are welcome in camera.ui, for writing code, tracking down a bug or translating a post. This policy is about what you submit, not about the tools you use. You are responsible for what you submit, however it was made, and we are responsible for what we merge and release.

It applies wherever camera.ui is discussed on GitHub: issues, discussions, pull requests, reviews and comments.

## In short

- **Use AI if it helps you.** Nobody has to avoid it.
- **A person reads and sends every post.** No bots or agents that post for you.
- **Describe your problem in your own words.** What you did, what you expected, what happened.
- **Report what you saw, not what an AI guessed.** An AI's theory about the cause is not a diagnosis.
- **Understand the code you submit.** Say how AI was used and be ready to explain every line.
- **If we misjudge your post, tell us.** We take you at your word.

## No autonomous agents

Every issue, discussion, comment and pull request has to be read and submitted by a person. Do not:

- connect a bot or agent that opens issues, discussions or pull requests without you reading them first
- post output from a tool you have not read
- file bulk or drive-by contributions with automated tooling

Posts that skip the templates are the most common sign of this. We close them and may mark them as spam.

## Issues, discussions and comments

Short and specific helps most. A long, polished post written by an AI takes longer to read and usually holds less than a few sentences of your own.

- **Your own words.** Tell us what you did, what you expected and what happened instead. Only you know that.
- **Observations, not guesses.** An AI's guess at the cause is often wrong and hides the details that lead to the real one. Post the log lines, not an interpretation of them.
- **The whole template.** It asks for version, installation, logs and camera because that is what we need to help. An AI cannot fill these in for you.
- **Answer questions yourself.** When a maintainer asks something, they are asking you. Having an AI fix grammar or wording is fine, the content has to be yours.

### Quoting AI output

If something an AI told you is relevant, put it in a quote block (`>`), name the tool and add a sentence on why it matters. Keep it short, no full transcripts.

### Writing in another language

We would rather read a translated post than none. Check that the translation says what you mean, and add your original text in a `<details>` block below it, so we can check the meaning when something reads oddly.

## Pull requests

Every merged change has to be maintained for years, often without its author. So we need contributors who understand what they submit. When AI wrote any part of a pull request:

1. **Say so.** The pull request template asks how AI was used. An honest answer does not count against you.
2. **Review and test it yourself** before you open the pull request. Read every line and run it on a real setup.
3. **Be able to explain it.** If a maintainer asks why a line is there, you answer, not your AI.
4. **Check for duplicates.** If a pull request for the same change exists, work with its author instead of opening another one.

The description and your replies in the review follow the same rules as issues: your own words.

We have the same AI tools you do. What makes a contribution valuable is your understanding of the problem, your testing with real cameras and your part in the review. Pull requests that look like unreviewed AI output are closed without review.

## Our use of AI

We may use AI tools to help with triage and reviews. Their comments can be wrong. If you think one is, say so, a short reason is enough. A maintainer makes the decision.

## Enforcement

Posts and contributions that break this policy are closed. Depending on the case, we may also hide comments, mark content as spam, lock a conversation or block an account from the project, for a while or for good.

### When we get it wrong

There is no reliable way to tell whether a text was written by an AI, so these are judgment calls. If we close or hide something you wrote yourself, reply and say so. We take you at your word and pick the conversation up again. We would rather reopen a post now and then than treat everyone as a suspect.

---

Parts of this policy are adapted from the [Open Home Foundation AI Policy](https://developers.home-assistant.io/docs/ai_policy/) and the [Frigate AI Policy](https://github.com/blakeblackshear/frigate/blob/dev/AI_POLICY.md).
