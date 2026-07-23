export const notice = {
  name: 'notice',
  title: 'Notice',
  type: 'document',
  fields: [
    {
      name: 'text',
      title: 'Notice Text',
      type: 'text',
      description: 'The content of the notice to be displayed on the dashboard.',
      validation: Rule => Rule.required()
    }
  ],
  preview: {
    select: {
      title: 'text'
    }
  }
}
