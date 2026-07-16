export const competition = {
  name: 'competition',
  title: 'Competitions / Hackathons',
  type: 'document',
  fields: [
    {
      name: 'title',
      title: 'Competition Title',
      type: 'string',
      validation: Rule => Rule.required()
    },
    {
      name: 'slug',
      title: 'Slug',
      type: 'slug',
      options: {
        source: 'title',
        maxLength: 96,
      },
      validation: Rule => Rule.required()
    },
    {
      name: 'coverImage',
      title: 'Cover Image',
      type: 'image',
      options: { hotspot: true },
    },
    {
      name: 'shortDescription',
      title: 'Short Description (Card)',
      type: 'text',
      validation: Rule => Rule.required().max(200)
    },
    {
      name: 'fullDetails',
      title: 'Full Details',
      type: 'array',
      of: [{ type: 'block' }]
    },
    {
      name: 'timeline',
      title: 'Timeline Stages',
      type: 'array',
      of: [
        {
          type: 'object',
          fields: [
            { name: 'stageName', title: 'Stage Name (e.g., Registration)', type: 'string' },
            { name: 'date', title: 'Date/Time (e.g., Oct 15 - Oct 20)', type: 'string' },
            { name: 'description', title: 'Brief Description', type: 'text' }
          ]
        }
      ]
    },
    {
      name: 'currentStageIndex',
      title: 'Current Stage Index',
      description: 'Which stage is currently active? (0-indexed). Example: 0 means the first stage is active.',
      type: 'number',
      initialValue: 0
    },
    {
      name: 'notices',
      title: 'Important Notices',
      type: 'array',
      of: [{ type: 'string' }]
    },
    {
      name: 'links',
      title: 'Important Links',
      type: 'array',
      of: [
        {
          type: 'object',
          fields: [
            { name: 'label', title: 'Link Label', type: 'string' },
            { name: 'url', title: 'URL', type: 'url' }
          ]
        }
      ]
    },
    {
      name: 'sponsors',
      title: 'Sponsors',
      type: 'array',
      of: [{ type: 'reference', to: { type: 'sponsor' } }]
    }
  ]
}
