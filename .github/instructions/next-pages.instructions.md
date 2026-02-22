---
applyTo: 'src/app/**/*.page.tsx'
---

### Next.js App Router Page Conventions

#### Server Components as Primary Data Layer

Pages should be **Server Components by default**. They are the primary entry point for data fetching and composition:

- **Use pages for data fetching**: Fetch data directly in page components using async/await
- **Pass data as props**: Pages compose client components and pass data via props
- **No `'use client'` in pages**: Keep page files as server components to leverage:
  - Direct database queries without API routes
  - Environment variable access
  - Secrets and sensitive configuration
  - Streaming and Suspense for progressive rendering

#### Client Component Separation

Break out interactive and stateful logic into dedicated client components:

- **Create `src/components/` directory**: Store all client components used by pages here
- **Use `'use client'` strictly in component files**: Only client components in the components directory should have the directive
- **Composition pattern**: Pages compose client components and pass data and callbacks as props
- **Example structure**:
  ```
  src/
    components/
      Counter.tsx           // Client component with 'use client'
      SearchForm.tsx        // Client component with 'use client'
    app/
      page.tsx              // Server component - fetches data
      layout.tsx            // Server component
  ```

#### Data Flow Example

```typescript
// src/app/page.tsx - Server Component
import { fetchPosts } from '@/lib/db';
import PostList from '@/components/PostList';

export default async function HomePage() {
  const posts = await fetchPosts();

  return (
    <div>
      <h1>Posts</h1>
      <PostList initialPosts={posts} />
    </div>
  );
}

// src/components/PostList.tsx - Client Component
'use client';

import { useState } from 'react';

interface PostListProps {
  initialPosts: Post[];
}

export function PostList({ initialPosts }: PostListProps) {
  const [posts, setPosts] = useState(initialPosts);

  return (
    <ul>
      {posts.map((post) => (
        <li key={post.id}>{post.title}</li>
      ))}
    </ul>
  );
}
```

#### Key Principles

1. **Minimize `'use client'` scope**: Only the components that need interactivity should be client components
2. **Pass data down**: Let pages fetch and pass data to client components, avoiding client-side data fetching when possible
3. **Keep pages clean**: Pages should focus on composition and data orchestration, delegating UI patterns to client components
4. **Use Suspense boundaries**: Wrap slower data-dependent sections with Suspense for better UX
5. **Prefer Server Actions**: For mutations, use Server Actions instead of API routes when possible
