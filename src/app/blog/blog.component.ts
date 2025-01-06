import { Component } from '@angular/core';
import { createClient } from '@supabase/supabase-js'

@Component({
  selector: 'app-blog',

  templateUrl: './blog.component.html',
  styleUrl: './blog.component.css'
})
export class BlogComponent {
  title = 'Ben Brutocao Blog!';

  data: any;
  ngOnInit() : void {
      try {
          this.fetchData().then((a)=>
          {
            this.data = a;
          });
        } catch (error) {
          console.error('Error fetching data:', error);
          // Handle error as needed
        }
        return;
    }

  async fetchData(){
      const supabase = createClient("", "");
      let { data: entries, error } = await supabase.from('post').select('*');
      if (error) {
          throw new Error(`Error fetching entries: ${error.message}`);
      }
      return entries;

  }
}