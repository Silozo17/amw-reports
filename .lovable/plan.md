

# Enhance "Performance by Post" Table

## Problem
The posts table currently shows only text content, reach, likes, comments, and shares. It's missing:
1. Post thumbnail images (`full_picture` is available in the data but not passed through)
2. Platform logo per row (data has `platform` but it's stripped when building table data)
3. Platform filter to show posts from specific platforms only

## Approach

### 1. Pass rich data to the table widget
**File: `src/components/clients/ClientDashboard.tsx` (lines ~344-363)**

- Add `image`, `platform`, and `permalink_url` fields to each row in `tableData`
- Add `engagement_rate` column
- Update `tableColumns` to include image, platform, and engagement rate columns
- Mark special columns with a `type` field (e.g., `type: 'image'`, `type: 'platform'`)

### 2. Extend `WidgetData` type to support a post platform filter
**File: `src/types/widget.ts`**

- Add optional `columnType` to the table column definition: `'text' | 'image' | 'platform' | 'link'`
- Add optional `filterOptions` and `onFilterChange` for the posts table filter

### 3. Enhance `TableWidget` in WidgetRenderer to render rich columns
**File: `src/components/clients/widgets/WidgetRenderer.tsx`**

- When `columnType === 'image'`: render a small thumbnail (`<img>` with rounded corners, fallback placeholder)
- When `columnType === 'platform'`: render the platform logo from `PLATFORM_LOGOS` map
- When `columnType === 'link'`: render an external link icon
- Truncate long post text to ~120 chars with ellipsis

### 4. Add platform filter dropdown to the posts table header
**File: `src/components/clients/widgets/WidgetRenderer.tsx`**

- When the widget is `table-posts`, render a small `<Select>` dropdown in the card header allowing filtering by platform (All, Facebook, Instagram, etc.)
- The filter state lives locally in the TableWidget component
- Filter options are derived from the distinct platforms present in the table data

## Technical Details

### Column definition extension
```typescript
// in widget.ts
tableColumns?: Array<{
  key: string;
  label: string;
  align?: 'left' | 'right';
  type?: 'text' | 'image' | 'platform' | 'link';
}>;
```

### Post table data shape (each row)
```typescript
{
  image: 'https://...jpg' | null,
  platform: 'facebook',
  content: 'Post caption text...',
  reach: 4002,
  likes: 9,
  comments: 7,
  shares: 0,
  engagement_rate: '3.5%',
  link: 'https://facebook.com/...',
}
```

### Platform filter in TableWidget
- Store `filterPlatform` state locally
- Derive unique platforms from `tableData` rows
- Filter displayed rows by selected platform
- Render platform logos as filter chips or a Select dropdown above the table

## Files Modified
1. `src/types/widget.ts` -- add `type` to column definition
2. `src/components/clients/ClientDashboard.tsx` -- enrich posts table data with image, platform, link
3. `src/components/clients/widgets/WidgetRenderer.tsx` -- render images, platform logos, links; add platform filter dropdown

