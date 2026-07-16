export const repository = {
  name: 'repository',
  title: 'Contribution Repositories',
  type: 'document',
  fields: [
    {
      name: 'title',
      title: 'Repository Title',
      type: 'string',
      validation: Rule => Rule.required()
    },
    {
      name: 'description',
      title: 'Description',
      type: 'text',
      validation: Rule => Rule.required().max(200)
    },
    {
      name: 'githubUrl',
      title: 'GitHub URL',
      type: 'url',
      validation: Rule => Rule.required()
    },
    {
      name: 'tags',
      title: 'Tech Stack / Tags',
      type: 'array',
      of: [{type: 'string'}],
      options: {
        layout: 'tags'
      }
    }
  ]
}
