import { RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { ChildrenOutletContexts } from '@angular/router';

import { createClient } from '@supabase/supabase-js'
@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent {
  title = 'BenBrutocao';

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

