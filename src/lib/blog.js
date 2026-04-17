export function getAdjacentPosts(postId, sourcePosts = []) {
  const currentIndex = sourcePosts.findIndex((post) => post.id === postId);

  if (currentIndex < 0) {
    return { previousPost: null, nextPost: null };
  }

  return {
    previousPost: sourcePosts[currentIndex - 1] || null,
    nextPost: sourcePosts[currentIndex + 1] || null,
  };
}

export function getRelatedPosts(postId, posts = [], limit = 3) {
  const currentPost = posts.find((post) => post.id === postId);

  if (!currentPost) {
    return [];
  }

  const currentTags = new Set(currentPost.tags.map((tag) => String(tag).toLowerCase()));

  return posts
    .filter((post) => post.id !== postId)
    .map((post) => {
      const sharedTags = post.tags.reduce(
        (count, tag) => count + (currentTags.has(String(tag).toLowerCase()) ? 1 : 0),
        0,
      );

      return {
        post,
        sharedTags,
        publishedAt: new Date(post.publishedAt).getTime(),
      };
    })
    .filter(({ sharedTags }) => sharedTags > 0)
    .sort((left, right) => right.sharedTags - left.sharedTags || right.publishedAt - left.publishedAt)
    .slice(0, limit)
    .map(({ post }) => post);
}

export function getPostReadingMinutes(post) {
  const text = [post.title, post.summary, ...post.content].join(" ");
  const latinWords = text.match(/[A-Za-z0-9]+(?:['’-][A-Za-z0-9]+)*/g)?.length || 0;
  const cjkChars = text.match(/[\u3400-\u9fff]/g)?.length || 0;
  const estimatedUnits = latinWords + cjkChars;

  return Math.max(1, Math.ceil(estimatedUnits / 280));
}

export function formatPostReadingTime(post) {
  return `${getPostReadingMinutes(post)} 分钟阅读`;
}
