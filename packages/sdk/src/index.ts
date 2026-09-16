/**
 * @kiln/capability-sdk
 *
 * The public, independently-versioned contract for writing a third-party
 * kiln capability plugin. See docs/plugin-architecture.md in the kiln repo
 * for the full design and the reasoning behind it.
 *
 * Design note: this package intentionally has no runtime dependency on
 * @kiln/core, which is a private, unpublished workspace package. Kiln's
 * own internals (like the concrete OwnershipTracker class) are free to
 * change without ever breaking a published plugin. Where a plugin needs to
 * work with something kiln constructs and hands it (an ownership tracker,
 * a capability plan), this SDK declares the shape as a structural
 * interface instead of importing the concrete implementation -- kiln's
 * real classes satisfy these interfaces automatically because TypeScript
 * types are structural, not nominal.
 *
 * The actual Capability interface and base plan/options types land in a
 * follow-up change (see issue #101). This file is intentionally a
 * placeholder until then.
 */

export const SDK_VERSION = '0.1.0';
