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
      const supabase = createClient("https://pnrjiudqwzklmvdxmlxz.supabase.co", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBucmppdWRxd3prbG12ZHhtbHh6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjAwNTQ1NjYsImV4cCI6MjAzNTYzMDU2Nn0.PjnBMGwSPqaW6Shez6xusYJfnKARVX7zstxrG71k7m4");
      let { data: entries, error } = await supabase.from('post').select('*');
      if (error) {
          throw new Error(`Error fetching entries: ${error.message}`);
      }
      return entries;

  }
}