export const dynamicActivity = {
  name: 'dynamicActivity',
  title: 'Upcoming Activities',
  type: 'document',
  fields: [
    {
      name: 'title',
      title: 'Activity Title',
      type: 'string',
      validation: Rule => Rule.required()
    },
    {
      name: 'shortDescription',
      title: 'Short Description (For Dashboard List)',
      type: 'text',
      rows: 3,
      validation: Rule => Rule.required()
    },
    {
      name: 'coverImage',
      title: 'Cover Image (Optional)',
      type: 'image',
      options: {
        hotspot: true
      }
    },
    {
      name: 'details',
      title: 'Detailed Description',
      type: 'text',
      rows: 5,
      description: 'Full details that appear when the user clicks the activity to open the modal.'
    },
    {
      name: 'actionButtons',
      title: 'Action Buttons',
      type: 'array',
      description: 'Add custom buttons (e.g., Register, Join Discord, View Form) that will appear in the modal.',
      of: [
        {
          type: 'object',
          fields: [
            {
              name: 'label',
              title: 'Button Label',
              type: 'string',
              validation: Rule => Rule.required()
            },
            {
              name: 'url',
              title: 'Button URL',
              type: 'url',
              validation: Rule => Rule.required()
            },
            {
              name: 'style',
              title: 'Button Style',
              type: 'string',
              options: {
                list: [
                  { title: 'Primary (Green)', value: 'primary' },
                  { title: 'Secondary (Outline)', value: 'secondary' }
                ],
                layout: 'radio'
              },
              initialValue: 'primary'
            }
          ]
        }
      ]
    },
    {
      name: 'isActive',
      title: 'Is Active?',
      type: 'boolean',
      initialValue: true,
      description: 'Toggle this to hide the activity from the dashboard.'
    }
  ]
}
