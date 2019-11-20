export default () => {
  console.log("hello world");
  return `
        const a = {
          name: '1',
          getName: () => {
            console.log('name', name)
          }
        }
        a.getName()
    `;
};
