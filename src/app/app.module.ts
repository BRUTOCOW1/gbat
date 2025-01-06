import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { ReactiveFormsModule } from '@angular/forms';

import { AppComponent } from './app.component';
import { RoundComponent } from './round/round.component';
import { BlogComponent } from './blog/blog.component';
import { RouterOutlet, RouterModule, RouterLink, RouterLinkActive} from '@angular/router';
import { CommonModule } from '@angular/common';
import { GolfComponent } from './golf/golf.component';
import { GolfShotComponent } from './golf-shot/golf-shot.component';

import {routes} from './app.routes'

@NgModule({
  declarations: [
    AppComponent,
    RoundComponent,
    BlogComponent,
    GolfComponent,
    GolfShotComponent

  ],
  imports: [
    BrowserModule,
    ReactiveFormsModule,
    CommonModule, 
    RouterOutlet, 
    RouterLink, 
    RouterLinkActive,
    RouterModule,
    RouterModule.forRoot(routes)
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
