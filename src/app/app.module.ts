import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { ProfileComponent } from './profile/profile.component';
import { AppComponent } from './app.component';
import { BlogComponent } from './blog/blog.component';
import { RouterOutlet, RouterModule, RouterLink, RouterLinkActive} from '@angular/router';
import { CommonModule } from '@angular/common';
import { GolfShotComponent } from './golf-shot/golf-shot.component';
import { LoginComponent } from './login/login.component';
import { GolfHoleComponent } from './golf-hole/golf-hole.component';
import {routes} from './app.routes'
import { GolfBagComponent } from './golf-bag/golf-bag.component';
import { GolfClubComponent } from './golf-club/golf-club.component';
import { GolfCourseComponent } from './golf-course/golf-course.component';
import { GolfRoundComponent } from './golf-round/golf-round.component';
import { NewRoundComponent } from './new-round/new-round.component';
import { CourseBuilderComponent } from './course-builder/course-builder.component';
import { RegisterComponent } from './register/register.component';
import { NavbarComponent } from './shared/navbar/navbar.component';
import { CreateGolfBagComponent } from './create-golf-bag/create-golf-bag.component';
import { HttpClientModule } from '@angular/common/http'; // Import HttpClientModule

@NgModule({
  declarations: [
    AppComponent,
    BlogComponent,
    CourseBuilderComponent,
    GolfShotComponent,
    GolfHoleComponent,
    GolfClubComponent,
    GolfCourseComponent,
    GolfRoundComponent,
    GolfBagComponent,
    LoginComponent,
    RegisterComponent,
    NavbarComponent,
    CreateGolfBagComponent,
    ProfileComponent,
    NewRoundComponent

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
