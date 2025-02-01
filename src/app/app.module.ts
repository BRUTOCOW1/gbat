import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { ProfileComponent } from './profile/profile.component';
import { AppComponent } from './app.component';
import { RoundComponent } from './round/round.component';
import { BlogComponent } from './blog/blog.component';
import { RouterOutlet, RouterModule, RouterLink, RouterLinkActive} from '@angular/router';
import { CommonModule } from '@angular/common';
import { GolfComponent } from './golf/golf.component';
import { GolfShotComponent } from './golf-shot/golf-shot.component';
import { LoginComponent } from './login/login.component';
import {routes} from './app.routes'
import { GolfBagComponent } from './golf-bag/golf-bag.component';
import { GolfClubComponent } from './golf-club/golf-club.component';
import { RegisterComponent } from './register/register.component';
import { NavbarComponent } from './shared/navbar/navbar.component';
import { CreateGolfBagComponent } from './create-golf-bag/create-golf-bag.component';
import { CreateGolfClubComponent } from './create-golf-club/create-golf-club.component';
import { HttpClientModule } from '@angular/common/http'; // Import HttpClientModule

@NgModule({
  declarations: [
    AppComponent,
    RoundComponent,
    BlogComponent,
    GolfComponent,
    GolfShotComponent,
    GolfClubComponent,
    GolfBagComponent,
    LoginComponent,
    RegisterComponent,
    NavbarComponent,
    CreateGolfBagComponent,
    CreateGolfClubComponent,
    ProfileComponent

  ],
  imports: [
    BrowserModule,
    HttpClientModule,
    ReactiveFormsModule,
    FormsModule,
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
